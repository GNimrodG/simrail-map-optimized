using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;
using Npgsql;
using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models;
using SMOBackend.Models.Entity;
using SMOBackend.Models.Trains;
using SMOBackend.Services;
using SMOBackend.Utils;

// ReSharper disable FormatStringProblem

namespace SMOBackend.Analytics;

/// <summary>
/// Service to analyze signals and their connections.
/// </summary>
public partial class SignalAnalyzerService : IHostedService, IServerMetricsCleaner
{
    private static readonly Gauge SignalAnalyzerQueueGauge = Metrics
        .CreateGauge("smo_signal_analyzer_queue", "Number of items in the signal analyzer queue");

    private static readonly Histogram InvalidTrainsHistogram = Metrics
        .CreateHistogram("smo_invalid_trains", "Number of invalid trains", ["server"], new()
        {
            Buckets = Histogram.LinearBuckets(0, 1, 30) // 0 to 30 invalid trains
        });

    private static readonly Gauge SignalsWithMultipleTrainsPerServer = Metrics
        .CreateGauge("smo_signals_with_multiple_trains_per_server", "Number of signals with multiple trains per server",
            "server");

    private static readonly Gauge SignalsWithMultipleTrains = Metrics
        .CreateGauge("smo_signals_with_multiple_trains", "The count of trains pointing to the same signal", "server",
            "signal");

    private readonly int _bufferDistanceBetweenPositions =
        Environment.GetEnvironmentVariable("SIGNAL_BUFFER_DISTANCE_BETWEEN") is { } bufferDistance
            ? int.Parse(bufferDistance)
            : 50;

    private readonly ILogger<SignalAnalyzerService> _logger;

    private readonly int _minDistanceBetweenSignals =
        Environment.GetEnvironmentVariable("SIGNAL_MIN_DISTANCE_BETWEEN") is { } minDistance
            ? int.Parse(minDistance)
            : 200;

    private readonly int _minDistanceToSignal =
        Environment.GetEnvironmentVariable("SIGNAL_MIN_DISTANCE") is { } minDistance
            ? int.Parse(minDistance)
            : 100;

    private readonly QueueProcessor<Dictionary<string, Train[]>> _queueProcessor;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TrainDataService _trainDataService;

    private readonly TtlCache<string, string> _trainLastSignalCache =
        new(TimeSpan.FromSeconds(30), "TrainLastSignalCache");

    private readonly TtlCache<string, string> _trainPassedSignalCache =
        new(TimeSpan.FromMinutes(5), "TrainPassedSignalCache");

    private readonly TtlCache<string, TrainPrevSignalData> _trainPrevSignalCache = new(TimeSpan.FromSeconds(30),
        "TrainPrevSignalCache");

    private byte _runCount;

    /// <summary>
    /// Service to analyze signals and their connections.
    /// </summary>
    public SignalAnalyzerService(ILogger<SignalAnalyzerService> logger,
        IServiceScopeFactory scopeFactory,
        TrainDataService trainDataService)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _trainDataService = trainDataService;

        _queueProcessor =
            new(logger, ProcessTrainData, SignalAnalyzerQueueGauge);
    }

    /// <inheritdoc />
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting signal analyzer service...");

        await UpdateSignals(cancellationToken);

        _trainDataService.DataReceived += OnTrainDataReceived;
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping signal analyzer service...");

        _trainDataService.DataReceived -= OnTrainDataReceived;
        _queueProcessor.ClearQueue();

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public void ClearServerMetrics(string serverCode)
    {
        // Clear invalid trains histogram metrics for the offline server
        var invalidTrainsLabels = InvalidTrainsHistogram.GetAllLabelValues()
            .Where(labels => labels.Length > 0 && labels[0] == serverCode)
            .ToList();
        foreach (var labels in invalidTrainsLabels) InvalidTrainsHistogram.RemoveLabelled(labels);

        // Clear signals with multiple trains per server metrics
        var signalsMultipleTrainsPerServerLabels = SignalsWithMultipleTrainsPerServer.GetAllLabelValues()
            .Where(labels => labels.Length > 0 && labels[0] == serverCode)
            .ToList();
        foreach (var labels in signalsMultipleTrainsPerServerLabels)
            SignalsWithMultipleTrainsPerServer.RemoveLabelled(labels);

        // Clear signals with multiple trains metrics
        var signalsMultipleTrainsLabels = SignalsWithMultipleTrains.GetAllLabelValues()
            .Where(labels => labels.Length > 0 && labels[0] == serverCode)
            .ToList();
        foreach (var labels in signalsMultipleTrainsLabels) SignalsWithMultipleTrains.RemoveLabelled(labels);

        // Clear train signal cache data for all trains from the offline server
        // Find all train IDs that belong to the offline server
        var trainIdsToRemove =
            _trainLastSignalCache.Keys.Where(trainId => trainId.Contains($"@{serverCode}-")).ToList();

        // Also check the previous signal cache for the same train IDs
        trainIdsToRemove.AddRange(_trainPrevSignalCache.Keys
            .Where(trainId => trainId.Contains($"@{serverCode}-") && !trainIdsToRemove.Contains(trainId)));

        // Remove train signal cache entries for offline server's trains
        foreach (var trainId in trainIdsToRemove)
        {
            _trainLastSignalCache.Remove(trainId);
            _trainPrevSignalCache.Remove(trainId);
            _trainPassedSignalCache.Remove(trainId);
        }

        _logger.LogInformation("Cleared {TrainCount} train signal cache records for offline server {ServerCode}",
            trainIdsToRemove.Count, serverCode);
    }

    private void AddTrainPrevSignalData(string trainId, TrainPrevSignalData data) =>
        _trainPrevSignalCache.Set(trainId, data);

    private TrainPrevSignalData? GetTrainPrevSignalData(string trainId) =>
        _trainPrevSignalCache.TryGetValue(trainId, out var data) ? data : null;

    private void UpdateTrainPrevSignalDataTtl(string trainId)
    {
        if (!_trainPrevSignalCache.TryGetValue(trainId, out var data)) return;
        _trainPrevSignalCache.Set(trainId, data);
    }

    private void OnTrainDataReceived(Dictionary<string, Train[]> data)
    {
        try
        {
            _logger.LogTrace("Received train data for {ServerCount} servers", data.Count);

            _queueProcessor.Enqueue(data);
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Error processing train data");
        }
    }

    private async Task<SignalStatus[]> GetSignals()
    {
        using var scope = _scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        const string sql = """
                           SELECT s.name,
                                  ST_X(s.location) as longitude,
                                  ST_Y(s.location) as latitude,
                                  s.extra,
                                  s.accuracy,
                                  s.type,
                                  s.role,
                                  s.prev_finalized,
                                  s.next_finalized,
                                  s.prev_regex,
                                  s.next_regex,
                                  COALESCE(prev_agg.prev_signals, '[]'::json) as prev_signals,
                                  COALESCE(next_agg.next_signals, '[]'::json) as next_signals
                           FROM signals s
                                    LEFT JOIN (
                               SELECT next,
                                      json_agg(json_build_object('name', prev, 'vmax', vmax)) as prev_signals
                               FROM (SELECT DISTINCT next, prev, vmax FROM signal_connections) p
                               GROUP BY next
                           ) prev_agg ON s.name = prev_agg.next
                                    LEFT JOIN (
                               SELECT prev,
                                      json_agg(json_build_object('name', next, 'vmax', vmax)) as next_signals
                               FROM (SELECT DISTINCT prev, next, vmax FROM signal_connections) n
                               GROUP BY prev
                           ) next_agg ON s.name = next_agg.prev
                           ORDER BY s.name
                           """;

        var results = await context.Database
            .SqlQueryRaw<OptimizedSignalStatusProjection>(sql)
            .ToListAsync();

        return results.Select(r => new SignalStatus
        {
            Name = r.Name,
            Extra = r.Extra,
            Accuracy = r.Accuracy,
            Type = r.Type,
            Role = r.Role,
            PrevFinalized = r.PrevFinalized,
            NextFinalized = r.NextFinalized,
            PrevRegex = r.PrevRegex,
            NextRegex = r.NextRegex,
            Location = new(r.Longitude, r.Latitude) { SRID = 4326 },
            PrevSignals = JsonConvert.DeserializeObject<List<SignalConnectionData>>(r.PrevSignals)
                ?.Select(c => new SignalStatus.SignalConnection(c.Name, c.Vmax))
                .DistinctBy(x => x.Name)
                .ToArray() ?? [],
            NextSignals = JsonConvert.DeserializeObject<List<SignalConnectionData>>(r.NextSignals)
                ?.Select(c => new SignalStatus.SignalConnection(c.Name, c.Vmax))
                .DistinctBy(x => x.Name)
                .ToArray() ?? []
        }).ToArray();
    }


    /// <summary>
    /// Gets the signals for the given trains.
    /// </summary>
    /// <param name="trains">The trains to get signals for.</param>
    /// <returns>The signals for the given trains.</returns>
    /// <exception cref="ArgumentNullException">Thrown when trains is null.</exception>
    public async Task<SignalStatus[]> GetSignalsForTrains(Train[] trains)
    {
        ArgumentNullException.ThrowIfNull(trains);

        try
        {
            // Skip if no trains are found
            if (trains.Length == 0)
            {
                _logger.LogWarning("No trains found, skipping signal analysis...");
                return await GetSignals();
            }

            var invalidTrainGroups = trains
                .Where(train => !string.IsNullOrEmpty(train.TrainData.SignalInFront))
                .GroupBy(t => t.TrainData.SignalInFront).Where(x => x.Count() > 1)
                .Select(x => x.ToArray())
                .ToArray();

            // clear smo_signals_with_multiple_trains for this server
            foreach (var labelValue in SignalsWithMultipleTrains.GetAllLabelValues())
            {
                if (labelValue[0] == trains[0].ServerCode)
                    SignalsWithMultipleTrains.RemoveLabelled(labelValue[0], labelValue[1]);
            }

            SignalsWithMultipleTrainsPerServer.WithLabels(trains[0].ServerCode).Set(invalidTrainGroups.Length);

            if (invalidTrainGroups.Length != 0)
            {
                // this can happen at the last block signal which can be passed on red with 20km/h or with subsidiary signals
                foreach (var trainGroup in invalidTrainGroups)
                {
                    _logger.LogWarning("{Signal}@{Server} has multiple trains pointing to it: {Trains}",
                        trainGroup[0].TrainData.GetSignal(),
                        trainGroup[0].ServerCode,
                        string.Join(", ", trainGroup.Select(t => t.GetTrainId())));

                    SignalsWithMultipleTrains.WithLabels(trainGroup[0].ServerCode, trainGroup[0].TrainData.GetSignal()!)
                        .Set(trainGroup.Length);
                }
            }

            // Create a dictionary of trains by signal name for quick lookup
            var signalsIndex = trains
                .Where(train => !string.IsNullOrEmpty(train.TrainData.SignalInFront))
                .GroupBy(train => train.TrainData.GetSignal()!)
                .ToDictionary(g => g.Key, g => g.OrderBy(x => x.TrainData.DistanceToSignalInFront).ToArray());

            var earlierSignalIndex = trains
                .Where(train => _trainLastSignalCache.ContainsKey(train.GetTrainId()))
                .Select(train => new
                {
                    data = _trainLastSignalCache.TryGetValue(train.GetTrainId(), out var value) ? value : null,
                    train
                })
                // filter for the last 30 seconds
                .Where(x => x.data != null)
                .GroupBy(train => train.data!)
                .ToDictionary(g => g.Key, g => g.Select(x => x.train).ToArray());

            var passedSignalIndex = trains
                .Where(train => _trainPassedSignalCache.ContainsKey(train.GetTrainId()))
                .Select(train => new
                {
                    data = _trainPassedSignalCache.TryGetValue(train.GetTrainId(), out var value) ? value : null,
                    train
                })
                // filter for the last 30 seconds
                .Where(x => x.data != null)
                .GroupBy(train => train.data!)
                .ToDictionary(g => g.Key, g => g.Select(x => x.train).ToArray());

            var signals = await GetSignals();
            var signalLookup = signals.ToDictionary(s => s.Name);

            // Process each signal in this batch
            foreach (var signal in signals)
            {
                var train = signalsIndex.GetValueOrDefault(signal.Name);
                signal.Trains = train?.Select(t => t.TrainNoLocal).ToArray();

                var earlierTrain = earlierSignalIndex.GetValueOrDefault(signal.Name);

                if (earlierTrain is { Length: > 0 })
                {
                    signal.TrainsAhead = earlierTrain.Select(x => x.TrainNoLocal).ToArray();
                    continue;
                }

                var onlyHasOneNextSignal = signal is
                    { Type: "block", NextSignals.Length: 1 } or
                    { Type: "main", NextFinalized: true, NextSignals.Length: 1 };

                // Get the train at the next signal ahead (if the signal only has one next signal)
                if (!onlyHasOneNextSignal)
                {
                    // if it has more than one next signal, but it's finalized and all the next signals have a train
                    if (signal is { Type: "main", NextFinalized: true } &&
                        signal.NextSignals.All(s => signalsIndex.ContainsKey(s.Name)))
                    {
                        signal.TrainsAhead = signal.NextSignals.Select(s => signalsIndex[s.Name])
                            .SelectMany(x => x.Select(y => y.TrainNoLocal))
                            .ToArray();
                    }

                    continue;
                }

                var nextSignalName = signal.NextSignals[0].Name;
                signal.TrainsAhead = signalsIndex
                                         .GetValueOrDefault(nextSignalName)?.Select(t => t.TrainNoLocal)
                                         .ToArray() ??
                                     (earlierSignalIndex.TryGetValue(nextSignalName, out var earlierTrains)
                                         ? earlierTrains.Select(x => x.TrainNoLocal).ToArray()
                                         : null);

                var blockingConnections = signal.GetBlockingConnections()
                    .Where(c =>
                    {
                        var nextTrains = signalsIndex.GetValueOrDefault(c.Next) ?? [];
                        var hasTrainAtNext = nextTrains.Length > 0;

                        var isSameTrainComingFromPrev = passedSignalIndex.TryGetValue(c.Prev, out var prevTrains) &&
                                                        prevTrains.Length > 0 &&
                                                        prevTrains.All(t => nextTrains.Contains(t));

                        return hasTrainAtNext && isSameTrainComingFromPrev;
                    })
                    .SelectMany(c => signalsIndex.GetValueOrDefault(c.Next)?.Select(t => t.TrainNoLocal) ?? [])
                    .ToArray();

                if (blockingConnections.Length > 0)
                {
                    signal.TrainsAhead ??= [];

                    signal.TrainsAhead = signal.TrainsAhead
                        .Concat(blockingConnections)
                        .Distinct()
                        .ToArray();
                }

                // Check for a train two signals ahead
                if (!signalLookup.TryGetValue(nextSignalName, out var nextSignal) ||
                    nextSignal is not
                        ({ Type: "block", NextSignals.Length: 1 } or
                        { Type: "main", NextFinalized: true, NextSignals.Length: 1 })) continue;

                var nextNextSignalName = nextSignal.NextSignals[0].Name;

                if (signalsIndex.ContainsKey(
                        nextNextSignalName)) // check if there is a train before the next-next signal
                    signal.NextSignalWithTrainAhead = nextSignalName;
            }

            return signals;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting signals for trains");
            throw;
        }
    }

    private async Task UpdateSignals(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Updating signals...");
        using var scope = _scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        var count = await context.Signals.CountAsync(cancellationToken: cancellationToken);

        if (count == 0)
        {
            _logger.LogInformation("No signals found, skipping role update...");
            return;
        }

        const int parcelSize = 1000;

        var parcelCount = (int)Math.Ceiling((double)count / parcelSize);

        _logger.LogInformation("Checking types and roles of {Count} signals...", count);

        for (var i = 0; i < parcelCount; i++)
        {
            var signals = await context.Signals
                .OrderBy(s => s.Name)
                .Skip(i * parcelSize)
                .Take(parcelSize)
                .Include(s => s.NextSignalConnections)
                .Include(s => s.PrevSignalConnections)
                .AsSplitQuery()
                .ToListAsync(cancellationToken);

            foreach (var signal in signals)
            {
                if (signal.Type == null)
                    signal.UpdateType(null);
                signal.UpdateRole();
            }
        }

        _logger.LogInformation("Saving {Count} updated signals...",
            context.ChangeTracker.Entries().Count(x => x.State == EntityState.Modified));
        await context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Signals updated successfully");
    }

    private static async Task<Dictionary<string, MinimalSignalData>> GetRelevantSignalsOptimized(
        string[] relevantSignalNames, SmoContext context)
    {
        if (relevantSignalNames.Length == 0)
            return new();

        const string sql = """
                           SELECT s.name, s.accuracy, s.type, s.prev_finalized, s.next_finalized, 
                                  s.prev_regex, s.next_regex,
                                  COALESCE(
                                      json_agg(
                                          json_build_object('name', pc.prev, 'vmax', pc.vmax)
                                      ) FILTER (WHERE pc.prev IS NOT NULL), 
                                      '[]'::json
                                  ) as prev_connections,
                                  COALESCE(
                                      json_agg(
                                          json_build_object('name', nc.next, 'vmax', nc.vmax)
                                      ) FILTER (WHERE nc.next IS NOT NULL), 
                                      '[]'::json
                                  ) as next_connections
                           FROM signals s
                           LEFT JOIN signal_connections pc ON s.name = pc.next
                           LEFT JOIN signal_connections nc ON s.name = nc.prev
                           WHERE s.name = ANY(@signalNames)
                           GROUP BY s.name, s.accuracy, s.type, s.prev_finalized, s.next_finalized, 
                                    s.prev_regex, s.next_regex
                           """;

        var signalData = await context.Database
            .SqlQueryRaw<OptimizedSignalProjection>(sql,
                new NpgsqlParameter("@signalNames", relevantSignalNames))
            .ToListAsync();

        return signalData.ToDictionary(
            s => s.Name,
            s => new MinimalSignalData(
                s.Name,
                s.Accuracy,
                s.Type,
                s.PrevFinalized,
                s.NextFinalized,
                s.PrevRegex,
                s.NextRegex,
                JsonConvert.DeserializeObject<List<SignalConnectionData>>(s.PrevConnections)
                    ?.Select(c => new MinimalSignalData.SignalConnection(c.Name, c.Vmax))
                    .ToList() ?? [],
                JsonConvert.DeserializeObject<List<SignalConnectionData>>(s.NextConnections)
                    ?.Select(c => new MinimalSignalData.SignalConnection(c.Name, c.Vmax))
                    .ToList() ?? []
            )
        );
    }

    private async Task ProcessTrainData(Dictionary<string, Train[]> trains)
    {
        var runCount = ++_runCount;

        if (_runCount == byte.MaxValue)
            _runCount = 0;

        using var logScope = _logger.BeginScope("[RUN#{RunCount:000}]", runCount);

        _logger.LogInformation("Processing train data...");

        var stopwatch = new Stopwatch();
        stopwatch.Start();
        var invalidTrainsPerServer = trains.Values.SelectMany(t => t)
            .GroupBy(t => t.ServerCode)
            .ToDictionary(g => g.Key, _ => 0);

        var allTrains = trains.Values.SelectMany(t => t).ToList();

        var relevantSignals = allTrains.Select(t => t.TrainData.GetSignal())
            .Concat(_trainPrevSignalCache.Keys
                .Select(trainId => GetTrainPrevSignalData(trainId)?.SignalName))
            .Where(s => s != null)
            .Select(s => s!) // Cast to non-nullable string
            .Distinct()
            .ToArray();

        using var scope = _scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        var signalLookup = await GetRelevantSignalsOptimized(relevantSignals, context);
        var signals = signalLookup.Values.ToList();

        // Important: as these are all the trains in every server, one signal can change multiple times
        foreach (var train in allTrains)
        {
            if (train.TrainData.Location is null)
            {
                _logger.LogWarning("Train {TrainId} ({TrainType}) has no location data!",
                    train,
                    train.Type);
                UpdateTrainPrevSignalDataTtl(train.GetTrainId());
                continue;
            }

            if (string.IsNullOrEmpty(train.TrainData.SignalInFront))
            {
                // this happens when the train is really far away from any signal (~5km+)
                UpdateTrainPrevSignalDataTtl(train.GetTrainId());
                continue;
            }

            var signalId = train.TrainData.GetSignal()!;
            var signal = signalLookup.GetValueOrDefault(signalId);

            // Cache DateTime.Now to avoid multiple calls and be more precise
            var currentTime = DateTime.Now;

            if (train.TrainData.DistanceToSignalInFront < _minDistanceToSignal)
            {
                try
                {
                    signal = await UpdateSignal(signal, train, signalId, context, signals, signalLookup);
                }
                catch (Exception e)
                {
                    _logger.LogError(e, "Failed to process signal data");
                    continue;
                }
            }

            if (signal != null)
            {
                var prevSignalData = GetTrainPrevSignalData(train.GetTrainId());

                if (prevSignalData != null)
                {
                    if (prevSignalData.SignalName != signal.Name)
                    {
                        // Train has moved to a new signal - update the passed signal cache
                        _trainPassedSignalCache.Set(train.GetTrainId(), prevSignalData.SignalName);
                        _trainLastSignalCache.Set(train.GetTrainId(), signal.Name);
                    }

                    var isValid =
                        await ProcessPrevSignalData(context,
                            signals, signalLookup, train, signal, prevSignalData, currentTime);

                    if (!isValid)
                    {
                        invalidTrainsPerServer.TryGetValue(train.ServerCode, out var count);
                        invalidTrainsPerServer[train.ServerCode] = count + 1;
                    }
                }
            }

            AddTrainPrevSignalData(train.GetTrainId(), new(
                signalId,
                train.TrainData.SignalInFrontSpeed,
                train.TrainData.Location!,
                DateTime.Now, train.TrainData.Velocity));
        }

        await context.SaveChangesAsync();

        var elapsed = (int)stopwatch.ElapsedMilliseconds;
        stopwatch.Stop();

        var invalidTrainsSum = invalidTrainsPerServer.Values.Sum();

        _logger.LogInformation(
            "Signal analyzer finished in {Elapsed}ms with ({InvalidTrains}/{TrainCount}) invalid trains",
            elapsed, invalidTrainsSum, allTrains.Count);

        foreach (var (serverCode, count) in invalidTrainsPerServer)
            InvalidTrainsHistogram.WithLabels(serverCode).Observe(count);

        context.Stats.Add(new("SIGNALS-PROC", elapsed, allTrains.Count, invalidTrainsSum));
        await context.SaveChangesAsync();
    }

    private async Task<MinimalSignalData> UpdateSignal(MinimalSignalData? signal, Train train,
        string signalId,
        SmoContext context,
        List<MinimalSignalData> signals, Dictionary<string, MinimalSignalData> signalLookup)
    {
        if (signal != null)
        {
            // signal already exists
            if (signal.Accuracy <= train.TrainData.DistanceToSignalInFront) return signal;

            var dbSignal = await signal.GetDbSignal(context);

            if (dbSignal == null)
            {
                _logger.LogError("Signal {SignalId} not found in the database, but exists in the lookup!", signalId);
                return signal;
            }

            // better accuracy
            dbSignal.Location = train.TrainData.Location!;
            signal.Accuracy = dbSignal.Accuracy = train.TrainData.DistanceToSignalInFront;


            _logger.LogInformation(
                "Updated signal {SignalId} accuracy to {DistanceToSignalInFront}m at train {TrainId}",
                signalId, train.TrainData.DistanceToSignalInFront, train.GetTrainId());

            var entry = context.Entry(dbSignal);
            entry.Property(e => e.Location).IsModified = true;
            entry.Property(e => e.Accuracy).IsModified = true;
            if (dbSignal.Type == null && dbSignal.UpdateType(train))
                entry.Property(e => e.Type).IsModified = true;
        }
        else
        {
            // new signal
            var extra = train.TrainData.GetSignalExtra()!;
            var dbSignal = new Signal
            {
                Name = signalId,
                Extra = extra,
                Accuracy = train.TrainData.DistanceToSignalInFront,
                Location = train.TrainData.Location!,
                PrevFinalized = false,
                NextFinalized = false,
                NextSignalConnections = [],
                PrevSignalConnections = [],
                CreatedBy = train.GetTrainId()
            };

            dbSignal.UpdateType(train);
            signal = new(dbSignal);

            if (signalLookup.TryAdd(signal.Name, signal))
            {
                _logger.LogInformation(
                    "New signal detected: {SignalId} at {Location} ({Extra}) with accuracy {DistanceToSignalInFront}m at train {TrainId}",
                    signalId, train.TrainData.Location, extra,
                    train.TrainData.DistanceToSignalInFront, train.GetTrainId());

                signals.Add(signal);
                context.Signals.Add(dbSignal);
            }
            else
            {
                _logger.LogError(
                    "Signal {SignalId} already exists in the signal lookup, but not in the database! This should not happen!",
                    signalId);
            }
        }

        return signal;
    }

    private async Task<bool> ProcessPrevSignalData(SmoContext context,
        List<MinimalSignalData> signals,
        Dictionary<string, MinimalSignalData> signalLookup,
        Train train, MinimalSignalData signal, TrainPrevSignalData prevSignalData, DateTime currentTime)
    {
        if (prevSignalData.SignalName == signal.Name || signal.PrevFinalized) return true;

        // Convert prevSpeed from km/h to m/s
        var prevSpeed = prevSignalData.Speed / 3.6;

        // Calculate the time difference in seconds
        var timeDiff = (currentTime - prevSignalData.TimeStamp).TotalSeconds;

        // Calculate the maximum possible distance in meters
        var maxDistance = prevSpeed * timeDiff + _bufferDistanceBetweenPositions;

        var distance = prevSignalData.Location.HaversineDistance(train.TrainData.Location!);

        if (distance > maxDistance)
        {
            _logger.LogTrace(
                "Train {TrainId} ({TrainType}) moved too far from the previous signal ({PrevSignalName})! Distance: {Distance}m, Max distance: {MaxDistance}m",
                train.GetTrainId(), train.Type, prevSignalData.SignalName, distance, maxDistance);

            return false;
        }

        var prevSignalId = prevSignalData.SignalName;
        var prevSignal = await TryGetSignal(prevSignalId, context);

        if (prevSignal == null)
        {
            _logger.LogWarning(
                "Train {TrainId} ({TrainType}) has reached signal {SignalId} from an unknown signal {PrevSignalName}!",
                train.GetTrainId(), train.Type, signal.Name, prevSignalId);
        }
        else if (!prevSignal.NextFinalized)
        {
            var isValid = await ValidateSignalConnection(context, prevSignal, signal, train, prevSignalData,
                prevSignalData.SignalSpeed);

            if (!isValid) return true;

            var dbConnection =
                new SignalConnection(prevSignal.Name, signal.Name, prevSignalData.SignalSpeed, train.GetTrainId());

            _logger.LogInformation("New signal connection: {Connection}", dbConnection);

            context.SignalConnections.Add(dbConnection);
            signal.PrevSignalConnections.Add(new(dbConnection.Prev, dbConnection.VMAX));
            prevSignal.NextSignalConnections.Add(new(dbConnection.Next, dbConnection.VMAX));
        }

        return true;

        async Task<MinimalSignalData?> TryGetSignal(string signalName, SmoContext dbContext)
        {
            var foundSignal = signalLookup.GetValueOrDefault(signalName);

            if (foundSignal != null) return foundSignal;

            var dbData = await dbContext.Signals
                .AsNoTracking()
                .Select(s => new
                {
                    s.Name,
                    s.Accuracy,
                    s.Type,
                    s.PrevFinalized,
                    s.NextFinalized,
                    s.PrevRegex,
                    s.NextRegex,
                    PrevSignalConnections = s.PrevSignalConnections.Select(c => new { c.Prev, c.VMAX }),
                    NextSignalConnections = s.NextSignalConnections.Select(c => new { c.Next, c.VMAX })
                })
                .FirstOrDefaultAsync(s => s.Name == signalName);

            foundSignal = dbData == null
                ? null
                : new MinimalSignalData(
                    dbData.Name,
                    dbData.Accuracy,
                    dbData.Type,
                    dbData.PrevFinalized,
                    dbData.NextFinalized,
                    dbData.PrevRegex,
                    dbData.NextRegex,
                    dbData.PrevSignalConnections.Select(c => new MinimalSignalData.SignalConnection(c.Prev, c.VMAX))
                        .ToList(),
                    dbData.NextSignalConnections.Select(c => new MinimalSignalData.SignalConnection(c.Next, c.VMAX))
                        .ToList());

            if (foundSignal == null) return foundSignal;

            signals.Add(foundSignal);
            signalLookup[foundSignal.Name] = foundSignal;

            return foundSignal;
        }
    }

    /// <summary>
    /// Validate the connection between two signals.
    /// </summary>
    /// <returns>True if the connection is valid, false otherwise.</returns>
    private async Task<bool> ValidateSignalConnection(SmoContext context, MinimalSignalData prevSignal,
        MinimalSignalData signal,
        Train train,
        TrainPrevSignalData prevSignalData, short vmax)
    {
        // if signal is known and prevSignal is also known and not finalized
        // check if connection already exists
        if (prevSignal.NextSignalConnections.Any(c => c.Signal == signal.Name) ||
            signal.PrevSignalConnections.Any(c => c.Signal == prevSignal.Name))
        {
            var existingConnection =
                prevSignal.NextSignalConnections.FirstOrDefault(c => c.Signal == signal.Name) ??
                signal.PrevSignalConnections.FirstOrDefault(c => c.Signal == prevSignal.Name);

            if (existingConnection == null)
            {
                _logger.LogCritical(
                    "Signal connection {PrevSignalName}->{SignalName} is null!",
                    prevSignal.Name, signal.Name);
                return false;
            }

            if (existingConnection.Vmax != null && existingConnection.Vmax >= vmax) return false;

            var dbConnection = await context.SignalConnections
                .FirstOrDefaultAsync(c => c.Prev == prevSignal.Name && c.Next == signal.Name);

            if (dbConnection == null)
            {
                _logger.LogError(
                    "Signal connection {PrevSignalName}->{SignalName} not found in the database!",
                    prevSignal.Name, signal.Name);
                return false;
            }

            dbConnection.VMAX = vmax;
            context.Entry(dbConnection).Property(c => c.VMAX).IsModified = true;

            _logger.LogInformation(
                "Updated signal connection {Connection} with VMAX of {Vmax} km/h",
                dbConnection, vmax);

            return false;
        }

        // check if connection already exists in the other direction
        if (prevSignal.PrevSignalConnections.Any(c => c.Signal == signal.Name) ||
            signal.NextSignalConnections.Any(c => c.Signal == prevSignal.Name))
        {
            TryLogError(
                prevSignal.Name, signal.Name,
                $"Connection between {prevSignal.Name} and {signal.Name} already exists in the other direction!",
                train.GetTrainId(), prevSignalData.SignalSpeed);
            return false;
        }

        // check if prevSignal's next regex is valid for the current signal
        if (!string.IsNullOrEmpty(prevSignal.NextRegex) &&
            !Regex.IsMatch(signal.Name, prevSignal.NextRegex))
        {
            TryLogError(
                prevSignal.Name, signal.Name,
                $"Signal {signal.Name} does not match the next regex of {prevSignal.Name} ({prevSignal.NextRegex})!",
                train.GetTrainId(), prevSignalData.SignalSpeed);
            return false;
        }

        // check if signal's prev regex is valid for the prevSignal
        if (!string.IsNullOrEmpty(signal.PrevRegex) &&
            !Regex.IsMatch(prevSignal.Name, signal.PrevRegex))
        {
            TryLogError(
                prevSignal.Name, signal.Name,
                $"Signal {prevSignal.Name} does not match the prev regex of {signal.Name} ({signal.PrevRegex})!",
                train.GetTrainId(), prevSignalData.SignalSpeed);
            return false;
        }

        // check for block signal limitations
        if (prevSignal.Type == "block")
        {
            var isReverse = Signal.BLOCK_SIGNAL_REVERSE_REGEX().IsMatch(prevSignal.Name);

            switch (isReverse)
            {
                // if prevSignal is reverse block signal then the next signal can't be a non-reverse *block* signal
                case true when !Signal.BLOCK_SIGNAL_REVERSE_REGEX().IsMatch(signal.Name) &&
                               Signal.BLOCK_SIGNAL_REGEX().IsMatch(signal.Name):
                    TryLogError(
                        prevSignal.Name, signal.Name,
                        $"Reverse block signal {prevSignal.Name} can't be followed by a non-reverse block signal {signal.Name}!",
                        train.GetTrainId(), prevSignalData.SignalSpeed);
                    return false;
                // if prevSignal a non-reverse block signal then the next signal can't be a reverse block signal
                case false when Signal.BLOCK_SIGNAL_REVERSE_REGEX().IsMatch(signal.Name):
                    TryLogError(
                        prevSignal.Name, signal.Name,
                        $"Non-reverse block signal {prevSignal.Name} can't be followed by a reverse block signal {signal.Name}!",
                        train.GetTrainId(), prevSignalData.SignalSpeed);
                    return false;
            }

            // a block signal can only have one next signal
            if (prevSignal.NextSignalConnections.Count != 0)
            {
                TryLogError(
                    prevSignal.Name, signal.Name,
                    $"Block signal {prevSignal.Name} can't have more than one next signal!",
                    train.GetTrainId(), prevSignalData.SignalSpeed);
                return false;
            }
        }

        // check if signals are parallel
        if (SIDING_SIGNAL_BASE_NAME_REGEX().Replace(signal.Name, "$1") ==
            SIDING_SIGNAL_BASE_NAME_REGEX().Replace(prevSignal.Name, "$1"))
        {
            TryLogError(
                prevSignal.Name, signal.Name,
                $"Signals {prevSignal.Name} and {signal.Name} are probably parallel (1-2) and can't be connected!",
                train.GetTrainId(), prevSignalData.SignalSpeed);
            return false;
        }

        var prevMatch = SIGNAL_BASE_NAME_REGEX().Match(prevSignal.Name);
        var currMatch = SIGNAL_BASE_NAME_REGEX().Match(signal.Name);

        if (prevMatch.Success && currMatch.Success && prevMatch.Groups[1].Value == currMatch.Groups[1].Value)
        {
            var prevLetter = prevMatch.Groups[2].Value;
            var currLetter = currMatch.Groups[2].Value;

            if (Math.Abs(prevLetter[0] - currLetter[0]) == 1)
            {
                TryLogError(
                    prevSignal.Name, signal.Name,
                    $"Signals {prevSignal.Name} and {signal.Name} are probably parallel (A-B) and can't be connected!",
                    train.GetTrainId(), prevSignalData.SignalSpeed);
                return false;
            }
        }

        var dbPrevSignalLocation = await context.Signals
            .Where(s => s.Name == prevSignal.Name)
            .Select(s => s.Location)
            .FirstOrDefaultAsync();

        if (dbPrevSignalLocation == null)
        {
            _logger.LogError(
                "Signal {SignalId} not found in the database, but exists in the lookup!", prevSignal.Name);
            return false;
        }

        var signalLocation = await context.Signals
            .Where(s => s.Name == signal.Name)
            .Select(s => s.Location)
            .FirstOrDefaultAsync();

        if (signalLocation == null)
        {
            _logger.LogError(
                "Signal {SignalId} not found in the database, but exists in the lookup!", signal.Name);
            return false;
        }

        // check if distance between signals is less than MinDistanceBetweenSignals
        if (dbPrevSignalLocation.HaversineDistance(signalLocation) < _minDistanceBetweenSignals)
        {
            TryLogError(
                prevSignal.Name, signal.Name,
                $"Distance between {prevSignal.Name} and {signal.Name} is less than {_minDistanceBetweenSignals}m!",
                train.GetTrainId(), prevSignalData.SignalSpeed);
            return false;
        }

        return true;
    }

    private async void TryLogError(string prev, string next, string error, string trainId, short vmax)
    {
        try
        {
            var errorText = error.Length > 500 ? error[..500] : error;

            using var scope = _scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

            var existing = await context.SignalConnectionErrors
                .AnyAsync(x => x.Prev == prev && x.Next == next && x.Error == errorText);

            if (existing) return;

            _logger.LogWarning("Signal connection error: {ErrorMessage}", error);
            context.SignalConnectionErrors.Add(new(prev, next, error, trainId, vmax));
            await context.SaveChangesAsync();
        }
        catch (Exception e)
        {
            _logger.LogWarning("Failed to log signal connection error: {ErrorMessage}", e.Message);
            _logger.LogDebug(e, "Failed to log signal connection error");
        }
    }

    /// <summary>
    /// Group[1] basically removed the numbers from the end
    /// </summary>
    [GeneratedRegex(@"^(.+_[A-Z])\d+$")]
    private static partial Regex SIDING_SIGNAL_BASE_NAME_REGEX();

    [GeneratedRegex(@"^(.+)_([A-Z])$")]
    private static partial Regex SIGNAL_BASE_NAME_REGEX();

    /// <summary>
    ///     Gets the name of the previous signal that the train has actually passed.
    /// </summary>
    /// <param name="trainId">The train identifier</param>
    /// <returns>The name of the passed signal, or null if no signal has been passed or data has expired</returns>
    public string? GetTrainPassedSignalName(string trainId)
    {
        return _trainPassedSignalCache.TryGetValue(trainId, out var passedSignalName) ? passedSignalName : null;
    }

    /// <summary>
    ///     Represents the previous signal data for a train.
    /// </summary>
    public record TrainPrevSignalData(
        string SignalName,
        short SignalSpeed,
        Point Location,
        DateTime TimeStamp,
        double Speed);

    private class MinimalSignalData(
        string name,
        double accuracy,
        string? type,
        bool prevFinalized,
        bool nextFinalized,
        string? prevRegex,
        string? nextRegex,
        List<MinimalSignalData.SignalConnection> prevSignalConnections,
        List<MinimalSignalData.SignalConnection> nextSignalConnections)
    {
        public MinimalSignalData(Signal signal) : this(
            signal.Name,
            signal.Accuracy,
            signal.Type,
            signal.PrevFinalized,
            signal.NextFinalized,
            signal.PrevRegex,
            signal.NextRegex,
            signal.PrevSignalConnections.Select(c => new SignalConnection(c.Prev, c.VMAX)).ToList(),
            signal.NextSignalConnections.Select(c => new SignalConnection(c.Next, c.VMAX)).ToList())
        {
            DbSignal = signal;
        }


        public string Name { get; } = name;
        public double Accuracy { get; set; } = accuracy;
        public string? Type { get; } = type;
        public bool PrevFinalized { get; } = prevFinalized;
        public bool NextFinalized { get; } = nextFinalized;
        public string? PrevRegex { get; } = prevRegex;
        public string? NextRegex { get; } = nextRegex;
        public List<SignalConnection> PrevSignalConnections { get; } = prevSignalConnections;
        public List<SignalConnection> NextSignalConnections { get; } = nextSignalConnections;

        private Signal? DbSignal { get; set; }

        public async Task<Signal?> GetDbSignal(SmoContext context)
        {
            if (DbSignal != null) return DbSignal;

            var dbSignal = await context.Signals
                .Include(s => s.PrevSignalConnections)
                .Include(s => s.NextSignalConnections)
                .FirstOrDefaultAsync(s => s.Name == Name);

            if (dbSignal != null)
                DbSignal = dbSignal;

            return dbSignal;
        }

        public record SignalConnection(string Signal, short? Vmax);
    }

    // ReSharper disable once ClassNeverInstantiated.Local
    private sealed class OptimizedSignalProjection
    {
        public required string Name { get; init; }
        public required double Accuracy { get; init; }
        public required string? Type { get; init; }
        public required bool PrevFinalized { get; init; }
        public required bool NextFinalized { get; init; }
        public required string? PrevRegex { get; init; }
        public required string? NextRegex { get; init; }
        public required string PrevConnections { get; init; }
        public required string NextConnections { get; init; }
    }

    // ReSharper disable once ClassNeverInstantiated.Local
    private sealed class OptimizedSignalStatusProjection
    {
        public required string Name { get; init; }
        public required double Longitude { get; init; }
        public required double Latitude { get; init; }
        public required string Extra { get; init; }
        public required double Accuracy { get; init; }
        public required string? Type { get; init; }
        public required string? Role { get; init; }
        public required bool PrevFinalized { get; init; }
        public required bool NextFinalized { get; init; }
        public required string? PrevRegex { get; init; }
        public required string? NextRegex { get; init; }
        public required string PrevSignals { get; init; }
        public required string NextSignals { get; init; }
    }

    // This can remain a struct since it's only used for JSON deserialization
    private readonly struct SignalConnectionData
    {
        public required string Name { get; init; }
        public required short? Vmax { get; init; }
    }
}