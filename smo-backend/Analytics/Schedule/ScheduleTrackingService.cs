using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models;
using SMOBackend.Models.Trains;
using SMOBackend.Services;
using SMOBackend.Services.ApiClients;
using SMOBackend.Utils;

namespace SMOBackend.Analytics.Schedule;

/// <summary>
///     Tells when the trains arrive at and leave their timetable points from where the points are, see
///     <see cref="ScheduleTracker" />: a station's main signals (from the database, named after the station: the
///     timetable point's id, "2133_Ku_A", or the station's prefix, "KO_A") and the position of a halt (OpenStreetMap's
///     railway stations and halts, refreshed weekly). Points it can't place keep the game's timetable index for their
///     delay (<see cref="TrainDelayAnalyzerService" />).
/// </summary>
public class ScheduleTrackingService(
    ILogger<ScheduleTrackingService> logger,
    IServiceScopeFactory scopeFactory,
    TrainDataService trainDataService,
    TrainPositionDataService trainPositionDataService,
    TimetableDataService timetableDataService,
    TimeDataService timeDataService,
    StationAnalyzerService stationAnalyzerService,
    OsmApiClient osmApiClient) : IHostedService, IServerMetricsCleaner
{
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "schedule");
    private static readonly string StopsFile = Path.Combine(DataDirectory, "osm-stops.json");

    /// <summary>The game's map, with a margin (south, west, north, east): where to look for the halts.</summary>
    private static readonly (double South, double West, double North, double East) MapArea = (49.8, 18.3, 52.9, 23.8);

    private static readonly TimeSpan SignalsRefresh = TimeSpan.FromHours(1);
    private static readonly TimeSpan StopsRefresh = TimeSpan.FromDays(7);

    private static readonly Gauge TrackedTrainsGauge = Metrics
        .CreateGauge("smo_schedule_tracked_trains", "Trains followed for their arrivals and departures");

    private readonly ScheduleTracker _tracker = new();
    private readonly ConcurrentDictionary<string, PointGeometry?> _geometries = new();
    private readonly ConcurrentDictionary<string, TimetableEntry[]> _timetables = new();
    private readonly ConcurrentDictionary<string, byte> _timetablesLoading = new();

    // main signals by the station part of their name (up to the last "_"): "2133_Ku", "KO"
    private volatile Dictionary<string, BoundarySignal[]> _signalsByStation = [];

    // halts and stations by normalized name
    private volatile Dictionary<string, GeoPoint> _stops = [];

    private CancellationTokenSource? _cancellation;
    private Task? _refreshTask;

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(DataDirectory);
        LoadStops();

        _cancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _refreshTask = RefreshPeriodically(_cancellation.Token);
        trainPositionDataService.PerServerDataReceived += OnPositions;

        logger.LogInformation("Schedule tracking started");
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        trainPositionDataService.PerServerDataReceived -= OnPositions;
        if (_cancellation != null) await _cancellation.CancelAsync().NoContext();
        if (_refreshTask != null) await _refreshTask.NoContext();
        _cancellation?.Dispose();
        logger.LogInformation("Schedule tracking stopped");
    }

    /// <inheritdoc />
    public void ClearServerMetrics(string serverCode)
    {
        foreach (var trainId in _tracker.TrainIds.Where(id => id.Contains($"@{serverCode}-")).ToList())
            Forget(trainId);
    }

    /// <summary>
    ///     The train's delays (seconds) by timetable index where it was tracked: leaving (or passing) the points it has
    ///     left, and arriving at (or passing) them, the one it's standing at included.
    /// </summary>
    public (Dictionary<short, int> Departures, Dictionary<short, int> Arrivals) GetDelays(Train train)
    {
        var departures = new Dictionary<short, int>();
        var arrivals = new Dictionary<short, int>();
        var trainId = train.GetTrainId();
        if (!_timetables.TryGetValue(trainId, out var entries) || timeDataService[train.ServerCode] is not { } time)
            return (departures, arrivals);

        foreach (var (index, times) in _tracker.GetTimes(trainId))
        {
            if (index >= entries.Length) continue;
            var entry = entries[index];

            if (times.Departure is { } departed && (entry.DepartureTime ?? entry.ArrivalTime) is { } plannedDeparture)
                departures[(short)index] = Delay(departed, plannedDeparture, time.Timezone);
            // the first point has no arrival (the train starts there)
            if (times.Arrival is { } arrived && entry.ArrivalTime is { } plannedArrival)
                arrivals[(short)index] = Delay(arrived, plannedArrival, time.Timezone);
        }

        return (departures, arrivals);
    }

    /// <summary>The arrival delays of the trains (by train id, then timetable index), where known.</summary>
    public Dictionary<string, Dictionary<short, int>> GetArrivalDelaysForTrains(Train[] trains)
    {
        var result = new Dictionary<string, Dictionary<short, int>>();
        foreach (var train in trains)
        {
            var (_, arrivals) = GetDelays(train);
            if (arrivals.Count > 0) result[train.Id] = arrivals;
        }

        return result;
    }

    internal static int Delay(long actual, string planned, int timezone)
    {
        var delay = (int)((actual - TrainDelayAnalyzerService.ParseScheduledTime(planned, timezone)) / 1000);
        // the planned time is on the day before or after (a train running around midnight)
        if (delay > 18 * 3600) delay -= 86400;
        else if (delay < -18 * 3600) delay += 86400;
        return delay;
    }

    private void OnPositions(PerServerData<TrainPosition[]> data)
    {
        try
        {
            if (timeDataService[data.ServerCode] is not { } timeData || trainDataService[data.ServerCode] is not { } trains)
                return;

            var now = TrainDelayAnalyzerService.CalculateServerTime(timeData);
            var trainsById = trains.ToDictionary(t => t.Id);

            foreach (var position in data.Data)
            {
                if (position is not { Latitude: { } lat, Longitude: { } lon } ||
                    !trainsById.TryGetValue(position.Id, out var train))
                    continue;

                var trainId = train.GetTrainId();
                if (!_timetables.TryGetValue(trainId, out var entries))
                {
                    LoadTimetable(train, trainId);
                    continue;
                }

                _tracker.Update(trainId, now, new(lat, lon), position.Velocity,
                    train.TrainData.VDDelayedTimetableIndex,
                    index => index < entries.Length ? GeometryOf(entries[index]) : null);
            }

            // the trains gone from this server
            var current = trains.Select(t => t.GetTrainId()).ToHashSet();
            foreach (var trainId in _tracker.TrainIds.Where(id => id.Contains($"@{data.ServerCode}-")).ToList())
                if (!current.Contains(trainId))
                    Forget(trainId);

            TrackedTrainsGauge.Set(_tracker.TrainIds.Count);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error tracking the trains' schedules on {ServerCode}", data.ServerCode);
        }
    }

    private void Forget(string trainId)
    {
        _tracker.Remove(trainId);
        _timetables.TryRemove(trainId, out _);
    }

    private void LoadTimetable(Train train, string trainId)
    {
        if (!_timetablesLoading.TryAdd(trainId, 0)) return;

        var cancellationToken = _cancellation?.Token ?? CancellationToken.None;
        _ = Task.Run(async () =>
        {
            try
            {
                var timetable = await timetableDataService
                    .GetTimetableForTrainAsync(train.ServerCode, train.TrainNoLocal, cancellationToken)
                    .NoContext();
                if (timetable != null) _timetables[trainId] = timetable.TimetableEntries;
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogWarning(e, "Failed to load the timetable of {TrainId}", trainId);
            }
            finally
            {
                _timetablesLoading.TryRemove(trainId, out _);
            }
        }, cancellationToken);
    }

    /// <summary>
    ///     Where a timetable point is: its station's main signals, or else its halt's position. Null when neither is
    ///     known (its delay then comes from the game's timetable index).
    /// </summary>
    private PointGeometry? GeometryOf(TimetableEntry entry) =>
        _geometries.GetOrAdd($"{entry.PointId}|{entry.NameOfPoint}",
            _ => Place(entry, _signalsByStation, StationKeys(stationAnalyzerService.GetStations(), entry), _stops));

    /// <summary>
    ///     Where a timetable point is: the main signals named after it (its point id, "2133_Ku_A", or one of its
    ///     stations' prefixes, "KO_A"), or else the railway station or halt of its name (OpenStreetMap's).
    /// </summary>
    /// <param name="entry">The timetable point.</param>
    /// <param name="signalsByStation">The main signals by the station part of their name.</param>
    /// <param name="stationPrefixes">The prefixes of the stations the point is (<see cref="StationKeys" />).</param>
    /// <param name="stops">Railway stations and halts by normalized name.</param>
    internal static PointGeometry? Place(TimetableEntry entry,
        IReadOnlyDictionary<string, BoundarySignal[]> signalsByStation, IReadOnlySet<string> stationPrefixes,
        IReadOnlyDictionary<string, GeoPoint> stops)
    {
        // the signals' and the stations' names don't always agree on the point id ("4700_WDC" for "WDC_A", "LCH" for
        // "2426_LCH_A" with the timetable's 2425) or the case ("Op" for "OP_A"): the abbreviation decides
        var abbreviations = stationPrefixes.Select(Abbreviation).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var signals = signalsByStation
            .Where(kv => abbreviations.Contains(Abbreviation(kv.Key)) ||
                         (!string.IsNullOrEmpty(entry.PointId) && kv.Key.StartsWith(entry.PointId + "_")))
            .SelectMany(kv => kv.Value)
            .ToArray();
        if (signals.Length > 0) return new(signals, null);

        var stop = new[] { entry.NameForPerson, entry.NameOfPoint, StationNames.ExpandAbbreviations(entry.NameOfPoint) }
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Select(NormalizeName)
            .Select(n => stops.TryGetValue(n, out var p) ? p : (GeoPoint?)null)
            .FirstOrDefault(p => p != null);
        return stop != null ? new PointGeometry([], stop) : null;
    }

    /// <summary>The prefixes of the stations a timetable point is (by its id or name), as its signals are named.</summary>
    internal static HashSet<string> StationKeys(IEnumerable<Station> stations, TimetableEntry entry) =>
        [
            ..stations
                .Where(s => (!string.IsNullOrEmpty(entry.PointId) && s.PointId == entry.PointId) ||
                            s.Name == entry.NameOfPoint)
                .Select(s => s.Prefix)
                .Where(p => !string.IsNullOrWhiteSpace(p)),
        ];

    /// <summary>A station prefix without its point id: "2133_Ku" -> "Ku", "KO" -> "KO".</summary>
    private static string Abbreviation(string prefix)
    {
        var underscore = prefix.IndexOf('_');
        return underscore > 0 && prefix[..underscore].All(char.IsAsciiDigit) ? prefix[(underscore + 1)..] : prefix;
    }

    internal static string NormalizeName(string name) =>
        string.Join(' ', name.Split(' ', StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();

    private async Task RefreshPeriodically(CancellationToken cancellationToken)
    {
        var stopsUpdated = File.Exists(StopsFile) ? File.GetLastWriteTimeUtc(StopsFile) : DateTime.MinValue;
        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                await LoadSignals(cancellationToken).NoContext();

                if (DateTime.UtcNow - stopsUpdated > StopsRefresh && await FetchStops(cancellationToken).NoContext())
                    stopsUpdated = DateTime.UtcNow;

                _geometries.Clear(); // placed again with what was just read
                await Task.Delay(SignalsRefresh, cancellationToken).NoContext();
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // stopping
        }
    }

    private async Task LoadSignals(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();
            var signals = await context.Signals
                .AsNoTracking()
                .Where(s => s.Type == "main" && s.Heading != null)
                .Select(s => new { s.Name, s.Location, s.Heading })
                .ToListAsync(cancellationToken)
                .NoContext();

            _signalsByStation = signals
                .Where(s => s.Name.Contains('_'))
                .GroupBy(s => s.Name[..s.Name.LastIndexOf('_')])
                .ToDictionary(g => g.Key,
                    g => g.Select(s => new BoundarySignal(s.Location.Y, s.Location.X, s.Heading!.Value)).ToArray());
            if (logger.IsEnabled(LogLevel.Information))
                logger.LogInformation("Schedule tracking: {SignalCount} main signals of {StationCount} stations",
                    signals.Count, _signalsByStation.Count);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            logger.LogError(e, "Failed to load the stations' signals for schedule tracking");
        }
    }

    private async Task<bool> FetchStops(CancellationToken cancellationToken)
    {
        var nodes = await osmApiClient
            .GetRailwayStopsAsync(MapArea.South, MapArea.West, MapArea.North, MapArea.East, cancellationToken)
            .NoContext();
        if (nodes == null || nodes.Length == 0) return false;

        var stops = new Dictionary<string, double[]>();
        foreach (var node in nodes)
            if (node.Tags.TryGetValue("name", out var name))
                stops.TryAdd(NormalizeName(name), [node.Lat, node.Lon]);

        await File.WriteAllTextAsync(StopsFile, JsonSerializer.Serialize(stops), cancellationToken).NoContext();
        _stops = stops.ToDictionary(kv => kv.Key, kv => new GeoPoint(kv.Value[0], kv.Value[1]));
        if (logger.IsEnabled(LogLevel.Information))
            logger.LogInformation("Schedule tracking: {StopCount} railway stations and halts from OpenStreetMap",
                stops.Count);
        return true;
    }

    private void LoadStops()
    {
        if (!File.Exists(StopsFile)) return;

        try
        {
            var stops = JsonSerializer.Deserialize<Dictionary<string, double[]>>(File.ReadAllText(StopsFile)) ?? [];
            _stops = stops.Where(kv => kv.Value.Length == 2)
                .ToDictionary(kv => kv.Key, kv => new GeoPoint(kv.Value[0], kv.Value[1]));
        }
        catch (Exception e) when (e is IOException or JsonException)
        {
            logger.LogWarning(e, "Failed to read {StopsFile}", StopsFile);
        }
    }
}
