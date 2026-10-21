using System.Collections.Concurrent;
using System.Globalization;
using Newtonsoft.Json;
using SMOBackend.Models;
using SMOBackend.Models.Trains;
using SMOBackend.Services;

namespace SMOBackend.Analytics;

/// <summary>
///     Learns where trains spawn (enter the map at a border station) and lists the trains that will spawn soon, from the
///     timetables.
/// </summary>
/// <remarks>
///     A spawn is learned from the live data: when a train shows up for the first time in a border station area, its
///     timetable index tells which timetable edge it entered on (the point before it and the point it runs to, or the
///     start of its run). An edge seen at least <see cref="MinEdgeCount" /> times is a spawn point, and every timetable
///     that runs over it spawns there. The usual difference between the scheduled time at the border and the actual
///     spawn is learned too, it's used for the expected spawn time.
/// </remarks>
public class SpawnAnalyzerService(
    ILogger<SpawnAnalyzerService> logger,
    TrainDataService trainDataService,
    TimetableDataService timetableDataService,
    TimeDataService timeDataService) : IHostedService
{
    private const string StartOfRun = "^";
    private const string ServerTimeFormat = "yyyy-MM-dd HH:mm:ss";

    /// <summary>
    ///     An edge is a spawn point after this many spawns (filters out the odd glitch).
    /// </summary>
    private const int MinEdgeCount = 2;

    /// <summary>
    ///     The number of recent spawn time offsets kept per edge.
    /// </summary>
    private const int MaxOffsetSamples = 30;

    /// <summary>
    ///     Offsets larger than this are wrong matches (e.g. a timetable of another day), not delays.
    /// </summary>
    private static readonly TimeSpan MaxOffset = TimeSpan.FromHours(3);

    /// <summary>
    ///     How long a spawned train stays in the list (marked as spawned).
    /// </summary>
    private static readonly TimeSpan SpawnedVisibleFor = TimeSpan.FromMinutes(10);

    /// <summary>
    ///     How long a train stays in the list after its expected spawn time when it hasn't spawned.
    /// </summary>
    private static readonly TimeSpan OverdueVisibleFor = TimeSpan.FromMinutes(15);

    /// <summary>
    ///     A server's train data older than this is a gap (e.g. the server or the API was down), every train in the next
    ///     data is new then, so it's not learned from.
    /// </summary>
    private static readonly TimeSpan MaxDataGap = TimeSpan.FromMinutes(1);

    /// <summary>
    ///     Edges not seen for this long are forgotten (e.g. map or timetable changes).
    /// </summary>
    private static readonly TimeSpan EdgeExpiry = TimeSpan.FromDays(30);

    private static readonly TimeSpan ListCacheDuration = TimeSpan.FromSeconds(15);

    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "spawns");
    private static readonly string EdgesFile = Path.Combine(DataDirectory, "spawn-edges.json");

    private readonly ConcurrentDictionary<string, SpawnEdge> _edges = new();
    private readonly ConcurrentDictionary<string, CompactTimetable[]> _timetables = new();
    private readonly ConcurrentDictionary<string, (HashSet<string> TrainIds, DateTime UpdatedAt)> _knownTrains = new();
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, RecentSpawn>> _recentSpawns = new();

    private readonly ConcurrentDictionary<string, (DateTime ComputedAt, int Hours, SpawnListEntry[] List)>
        _listCache = new();

    private Task? _persistenceTask;

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Starting spawn analyzer service...");
        Directory.CreateDirectory(DataDirectory);
        LoadEdges();

        timetableDataService.PerServerDataReceived += OnTimetablesReceived;
        trainDataService.PerServerDataReceived += OnTrainsReceived;

        _persistenceTask = Task.Run(async () => await RunPersistenceLoopAsync(cancellationToken),
            CancellationToken.None);

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Stopping spawn analyzer service...");

        timetableDataService.PerServerDataReceived -= OnTimetablesReceived;
        trainDataService.PerServerDataReceived -= OnTrainsReceived;

        await SaveEdgesAsync();

        if (_persistenceTask != null)
            try
            {
                await _persistenceTask.WaitAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                // Host is shutting down
            }
    }

    /// <summary>
    ///     Lists the trains that spawn on a server in the next <paramref name="hours" />, the ones that are overdue and
    ///     the ones that spawned in the last minutes, ordered by their (expected) spawn time.
    /// </summary>
    public SpawnListEntry[] GetSpawnList(string serverCode, int hours)
    {
        if (_listCache.TryGetValue(serverCode, out var cached) && cached.Hours == hours &&
            DateTime.UtcNow - cached.ComputedAt < ListCacheDuration)
            return cached.List;

        var list = ComputeSpawnList(serverCode, hours, DateTime.UtcNow);
        _listCache[serverCode] = (DateTime.UtcNow, hours, list);
        return list;
    }

    private SpawnListEntry[] ComputeSpawnList(string serverCode, int hours, DateTime nowUtc)
    {
        if (!_timetables.TryGetValue(serverCode, out var timetables) ||
            GetServerTimeOffset(serverCode, nowUtc) is not { } serverOffset)
            return [];

        var nowLocal = nowUtc + serverOffset;
        var until = nowLocal + TimeSpan.FromHours(hours);

        // the live consists by train number (a number can show up twice in the data, the first one is enough)
        var liveTrains = (trainDataService[serverCode] ?? [])
            .GroupBy(t => t.TrainNoLocal)
            .ToDictionary(g => g.Key, g => g.First().Vehicles);
        var recentSpawns = GetRecentSpawns(serverCode, nowUtc);

        var spawnEdges = _edges.Values.Where(e => e.Count >= MinEdgeCount)
            .ToDictionary(e => EdgeKey(e.From, e.To));

        var list = new List<SpawnListEntry>();

        foreach (var timetable in timetables)
        {
            if (recentSpawns.TryGetValue(timetable.TrainNoLocal, out var spawn))
            {
                var spawnedIndex = Math.Clamp(spawn.TimetableIndex, 0, timetable.Points.Length - 1);
                var liveConsist = liveTrains.GetValueOrDefault(timetable.TrainNoLocal);
                list.Add(CreateEntry(timetable, spawnedIndex, spawn.SpawnedAt, serverOffset, SpawnStatus.Spawned,
                    liveConsist ?? trainDataService.GetLastConsist(serverCode, timetable.TrainNoLocal),
                    liveConsist == null));
                continue;
            }

            if (liveTrains.ContainsKey(timetable.TrainNoLocal)) continue;

            var index = FindSpawnIndex(timetable, spawnEdges, out var edge);
            if (index < 0) continue;

            var expectedLocal = timetable.Times[Math.Max(index - 1, 0)] + edge!.MedianOffset();
            if (expectedLocal < nowLocal - OverdueVisibleFor || expectedLocal > until) continue;

            list.Add(CreateEntry(timetable, index, expectedLocal - serverOffset, serverOffset,
                expectedLocal < nowLocal ? SpawnStatus.Overdue : SpawnStatus.Upcoming,
                trainDataService.GetLastConsist(serverCode, timetable.TrainNoLocal), true));
        }

        return list.OrderBy(e => e.ExpectedAt).ToArray();
    }

    /// <summary>
    ///     The index of the timetable point a train runs to when it spawns: the first edge of its timetable that is a
    ///     spawn point. -1 when the train doesn't spawn at a border.
    /// </summary>
    internal static int FindSpawnIndex(CompactTimetable timetable, Dictionary<string, SpawnEdge> spawnEdges,
        out SpawnEdge? edge)
    {
        for (var i = 0; i < timetable.Points.Length; i++)
            if (spawnEdges.TryGetValue(EdgeKey(i == 0 ? null : timetable.Points[i - 1], timetable.Points[i]),
                    out edge))
                return i;

        edge = null;
        return -1;
    }

    private static SpawnListEntry CreateEntry(CompactTimetable timetable, int index, DateTime expectedAtUtc,
        TimeSpan serverOffset, SpawnStatus status, string[]? consist, bool consistFromLastRun)
    {
        var borderIndex = Math.Max(index - 1, 0);
        var entryIndex = index == 0 ? Math.Min(1, timetable.Points.Length - 1) : index;

        return new()
        {
            TrainNoLocal = timetable.TrainNoLocal,
            TrainName = timetable.TrainName,
            TrainType = timetable.TrainTypes[index],
            StartStation = timetable.StartStation,
            EndStation = timetable.EndStation,
            Border = timetable.Points[borderIndex],
            Entry = timetable.Points[entryIndex],
            ScheduledTime = timetable.Times[borderIndex].ToString(ServerTimeFormat, CultureInfo.InvariantCulture),
            ExpectedTime = (expectedAtUtc + serverOffset).ToString(ServerTimeFormat, CultureInfo.InvariantCulture),
            ExpectedAt = DateTime.SpecifyKind(expectedAtUtc, DateTimeKind.Utc),
            Status = status,
            LocoType = timetable.LocoType,
            TrainLength = timetable.TrainLength,
            TrainWeight = timetable.TrainWeight,
            Consist = consist is { Length: > 0 } ? consist : null,
            ConsistFromLastRun = consist is { Length: > 0 } && consistFromLastRun
        };
    }

    private Dictionary<string, RecentSpawn> GetRecentSpawns(string serverCode, DateTime nowUtc)
    {
        if (!_recentSpawns.TryGetValue(serverCode, out var spawns)) return [];

        foreach (var (trainNo, spawn) in spawns)
            if (nowUtc - spawn.SpawnedAt > SpawnedVisibleFor)
                spawns.TryRemove(trainNo, out _);

        return spawns.ToDictionary(x => x.Key, x => x.Value);
    }

    private void OnTimetablesReceived(PerServerData<Timetable[]> data)
    {
        try
        {
            _timetables[data.ServerCode] = data.Data
                .Where(t => t.TimetableEntries.Length > 0)
                .Select(CompactTimetable.From)
                .ToArray();
            _listCache.TryRemove(data.ServerCode, out _);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to index the timetables of {ServerCode} for the spawn list", data.ServerCode);
        }
    }

    private void OnTrainsReceived(PerServerData<Train[]> data)
    {
        try
        {
            var now = DateTime.UtcNow;
            var trainIds = data.Data.Select(t => t.Id).ToHashSet();
            var previous = _knownTrains.GetValueOrDefault(data.ServerCode);
            _knownTrains[data.ServerCode] = (trainIds, now);

            // the first data, or after a gap every train looks new
            if (previous.TrainIds == null || now - previous.UpdatedAt > MaxDataGap) return;

            var newTrains = data.Data.Where(t => !previous.TrainIds.Contains(t.Id)).ToArray();

            // a burst of new trains is a server restart or a data glitch, not spawns
            if (newTrains.Length > Math.Max(10, data.Data.Length / 10))
            {
                logger.LogInformation("Skipping {Count} new trains on {ServerCode}, too many at once to be spawns",
                    newTrains.Length, data.ServerCode);
                return;
            }

            foreach (var train in newTrains.Where(t => t.TrainData.InBorderStationArea))
                RecordSpawn(data.ServerCode, train, now);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to detect the spawned trains of {ServerCode}", data.ServerCode);
        }
    }

    private void RecordSpawn(string serverCode, Train train, DateTime nowUtc)
    {
        var timetable = _timetables.GetValueOrDefault(serverCode)?.FirstOrDefault(t => t.TrainNoLocal == train.TrainNoLocal);
        if (timetable == null) return;

        var index = (int)train.TrainData.VDDelayedTimetableIndex;
        if (index >= timetable.Points.Length) return;

        var from = index == 0 ? null : timetable.Points[index - 1];
        var to = timetable.Points[index];
        var edge = _edges.GetOrAdd(EdgeKey(from, to), _ => new() { From = from, To = to });

        TimeSpan? offset = null;
        if (GetServerTimeOffset(serverCode, nowUtc) is { } serverOffset)
        {
            offset = nowUtc + serverOffset - timetable.Times[Math.Max(index - 1, 0)];
            if (offset.Value.Duration() > MaxOffset) offset = null;
        }

        edge.Record(nowUtc, offset);

        _recentSpawns.GetOrAdd(serverCode, _ => new())[train.TrainNoLocal] = new(index, nowUtc);
        _listCache.TryRemove(serverCode, out _);

        logger.LogDebug("Train {TrainNoLocal}@{ServerCode} spawned at {From} -> {To} (offset {Offset})",
            train.TrainNoLocal, serverCode, from ?? StartOfRun, to, offset);
    }

    internal static string EdgeKey(string? from, string to) => $"{from ?? StartOfRun}>{to}";

    /// <summary>
    ///     How far the server's (in-game) clock is ahead of UTC. Not just the time zone: some servers (e.g. the Xbox
    ///     ones) run at a different time of day than the real one.
    /// </summary>
    private TimeSpan? GetServerTimeOffset(string serverCode, DateTime nowUtc)
    {
        if (timeDataService[serverCode] is not { } time) return null;

        // the server's local time when it was last fetched, moved on by the time since then
        var serverNow = DateTime.UnixEpoch.AddMilliseconds(time.Time) + (nowUtc - time.LastUpdated);
        return serverNow - nowUtc;
    }

    private void LoadEdges()
    {
        if (!File.Exists(EdgesFile)) return;

        try
        {
            var edges = JsonConvert.DeserializeObject<SpawnEdge[]>(File.ReadAllText(EdgesFile)) ?? [];
            foreach (var edge in edges.Where(e => DateTime.UtcNow - e.LastSeen < EdgeExpiry))
                _edges[EdgeKey(edge.From, edge.To)] = edge;

            logger.LogInformation("Loaded {Count} spawn edges", _edges.Count);
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Failed to load the spawn edges from {File}", EdgesFile);
        }
    }

    private async Task SaveEdgesAsync()
    {
        try
        {
            foreach (var (key, edge) in _edges)
                if (DateTime.UtcNow - edge.LastSeen > EdgeExpiry)
                    _edges.TryRemove(key, out _);

            var json = JsonConvert.SerializeObject(_edges.Values.Select(e => e.Snapshot()).ToArray());
            var tempFile = EdgesFile + ".tmp";
            await File.WriteAllTextAsync(tempFile, json);
            File.Move(tempFile, EdgesFile, true);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to save the spawn edges");
        }
    }

    private async Task RunPersistenceLoopAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
            while (await timer.WaitForNextTickAsync(cancellationToken)) await SaveEdgesAsync();
        }
        catch (OperationCanceledException)
        {
            // Host is shutting down
        }
    }

    private sealed record RecentSpawn(int TimetableIndex, DateTime SpawnedAt);

    /// <summary>
    ///     The parts of a timetable the spawn list needs, the times are in the server's time.
    /// </summary>
    internal sealed record CompactTimetable(
        string TrainNoLocal,
        string TrainName,
        string StartStation,
        string EndStation,
        string LocoType,
        int TrainLength,
        int TrainWeight,
        string[] Points,
        string[] TrainTypes,
        DateTime[] Times)
    {
        public static CompactTimetable From(Timetable timetable)
        {
            var entries = timetable.TimetableEntries;
            return new(
                timetable.TrainNoLocal,
                timetable.TrainName,
                timetable.StartStation,
                timetable.EndStation,
                string.Intern(timetable.LocoType),
                timetable.TrainLength,
                timetable.TrainWeight,
                entries.Select(e => string.Intern(e.NameOfPoint)).ToArray(),
                entries.Select(e => string.Intern(e.TrainType)).ToArray(),
                entries.Select(e => ParseTime(e.DepartureTime ?? e.ArrivalTime)).ToArray());
        }

        private static DateTime ParseTime(string? time) =>
            DateTime.TryParseExact(time, ServerTimeFormat, CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var parsed)
                ? parsed
                : DateTime.MinValue;
    }

    /// <summary>
    ///     A timetable edge trains spawn on: from the point before the border (null: the start of the run) to the first
    ///     point after it.
    /// </summary>
    internal sealed class SpawnEdge
    {
        private readonly Lock _lock = new();

        public string? From { get; init; }
        public required string To { get; init; }
        public int Count { get; set; }
        public DateTime LastSeen { get; set; }

        /// <summary>
        ///     Recent differences between the actual spawn and the scheduled time at the border, in seconds.
        /// </summary>
        public List<int> OffsetSeconds { get; init; } = [];

        public void Record(DateTime seenAt, TimeSpan? offset)
        {
            lock (_lock)
            {
                Count++;
                LastSeen = seenAt;

                if (offset == null) return;

                OffsetSeconds.Add((int)offset.Value.TotalSeconds);
                if (OffsetSeconds.Count > MaxOffsetSamples) OffsetSeconds.RemoveAt(0);
            }
        }

        public TimeSpan MedianOffset()
        {
            lock (_lock)
            {
                if (OffsetSeconds.Count == 0) return TimeSpan.Zero;

                var ordered = OffsetSeconds.Order().ToArray();
                return TimeSpan.FromSeconds(ordered[ordered.Length / 2]);
            }
        }

        public SpawnEdge Snapshot()
        {
            lock (_lock)
            {
                return new()
                {
                    From = From, To = To, Count = Count, LastSeen = LastSeen, OffsetSeconds = [..OffsetSeconds]
                };
            }
        }
    }
}
