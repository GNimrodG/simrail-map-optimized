using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
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
public partial class SignalAnalyzerService : IHostedService
{
    private readonly QueueProcessor<Dictionary<string, Train[]>> _queueProcessor;

    private record TrainPrevSignalData(
        string SignalName,
        short SignalSpeed,
        Point Location,
        DateTime TimeStamp,
        double Speed);

    private readonly int _minDistanceToSignal =
        Environment.GetEnvironmentVariable("SIGNAL_MIN_DISTANCE") is { } minDistance
            ? int.Parse(minDistance)
            : 100;

    private readonly int _minDistanceBetweenSignals =
        Environment.GetEnvironmentVariable("SIGNAL_MIN_DISTANCE_BETWEEN") is { } minDistance
            ? int.Parse(minDistance)
            : 200;

    private readonly int _bufferDistanceBetweenPositions =
        Environment.GetEnvironmentVariable("SIGNAL_BUFFER_DISTANCE_BETWEEN") is { } bufferDistance
            ? int.Parse(bufferDistance)
            : 50;

    private readonly TtlCache<string, TrainPrevSignalData> _trainPrevSignalCache = new(TimeSpan.FromSeconds(30));

    private static readonly Gauge SignalAnalyzerQueueGauge = Metrics
        .CreateGauge("smo_signal_analyzer_queue", "Number of items in the signal analyzer queue");

    private byte _runCount;
    private readonly ILogger<SignalAnalyzerService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TrainDataService _trainDataService;

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

    private void AddTrainPrevSignalData(string trainId, TrainPrevSignalData data) =>
        _trainPrevSignalCache.Set(trainId, data);

    private TrainPrevSignalData? GetTrainPrevSignalData(string trainId) =>
        _trainPrevSignalCache.TryGetValue(trainId, out var data) ? data : null;

    private void UpdateTrainPrevSignalDataTtl(string trainId)
    {
        if (!_trainPrevSignalCache.TryGetValue(trainId, out var data)) return;
        _trainPrevSignalCache.Set(trainId, data);
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

    private static readonly Gauge InvalidTrainsGauge = Metrics
        .CreateGauge("smo_invalid_trains", "Number of invalid trains", "server");

    public class SignalProjection
    {
        public string Name { get; set; } = string.Empty;
        public double Longitude { get; set; }
        public double Latitude { get; set; }
        public string Extra { get; set; } = string.Empty;
        public double Accuracy { get; set; }
        public string? Type { get; set; }
        public string? Role { get; set; }
        public bool PrevFinalized { get; set; }
        public bool NextFinalized { get; set; }
        public string? PrevRegex { get; set; }
        public string? NextRegex { get; set; }
        public string PrevSignals { get; set; } = string.Empty;
        public string NextSignals { get; set; } = string.Empty;

        public SignalStatus ToSignalStatus() => new()
        {
            Name = Name,
            Extra = Extra,
            Accuracy = Accuracy,
            Type = Type,
            Role = Role,
            PrevFinalized = PrevFinalized,
            NextFinalized = NextFinalized,
            PrevRegex = PrevRegex,
            NextRegex = NextRegex,
            Location = new(Longitude, Latitude) { SRID = 4326 },
            PrevSignals = PrevSignals
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => new SignalStatus.SignalConnection(s.Split(':')[0],
                    short.TryParse(s.Split(':')[1], out var vmax) ? vmax : null))
                .ToArray(),
            NextSignals = NextSignals
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => new SignalStatus.SignalConnection(s.Split(':')[0],
                    short.TryParse(s.Split(':')[1], out var vmax) ? vmax : null))
                .ToArray()
        };
    }

    private async Task<SignalStatus[]> GetSignals()
    {
        using var scope = _scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        // optimized query to get all signals with their connections
        const string sql = """
                           SELECT signals.name,
                                  ST_X(signals.location) as longitude,
                                  ST_Y(signals.location) as latitude,
                                  extra,
                                  accuracy,
                                  type,
                                  role,
                                  prev_finalized,
                                  next_finalized,
                                  prev_regex,
                                  next_regex,
                                  ARRAY_TO_STRING(ARRAY_AGG(DISTINCT (p.prev || ':' || COALESCE(p.vmax::varchar, ''))), ',') as prev_signals,
                                  ARRAY_TO_STRING(ARRAY_AGG(DISTINCT (n.next || ':' || COALESCE(n.vmax::varchar, ''))), ',') as next_signals
                           FROM signals
                                    LEFT JOIN signal_connections p ON signals.name = p.next
                                    LEFT JOIN signal_connections n ON signals.name = n.prev
                           GROUP BY signals.name
                           """;

        return (await context.Database
                .SqlQueryRaw<SignalProjection>(sql)
                .ToListAsync())
            .Select(s => s.ToSignalStatus()) // Convert to SignalStatus locally
            .ToArray();
    }

    private static readonly Gauge SignalsWithMultipleTrainsPerServer = Metrics
        .CreateGauge("smo_signals_with_multiple_trains_per_server", "Number of signals with multiple trains per server",
            "server");

    private static readonly Gauge SignalsWithMultipleTrains = Metrics
        .CreateGauge("smo_signals_with_multiple_trains", "The count of trains pointing to the same signal", "server",
            "signal");


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

            var signals = await GetSignals();
            var signalLookup = signals.ToDictionary(s => s.Name);

            // Process each signal in this batch
            foreach (var signal in signals)
            {
                var train = signalsIndex.GetValueOrDefault(signal.Name);
                signal.Trains = train?.Select(t => t.TrainNoLocal).ToArray();

                var onlyHasOneNextSignal = signal is
                    { Type: "block", NextSignals.Length: 1 } or
                    { Type: "main", NextFinalized: true, NextSignals.Length: 1 };

                // Get the train at the next signal ahead (if the signal only has one next signal)
                if (!onlyHasOneNextSignal) continue;

                var nextSignalName = signal.NextSignals[0].Name;
                signal.TrainsAhead = signalsIndex.GetValueOrDefault(nextSignalName)?.Select(t => t.TrainNoLocal)
                    .ToArray();

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
        public record SignalConnection(string Signal, short? Vmax);


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
        var invalidTrainsPerServer = new Dictionary<string, int>();
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

        var signals = (await
                context.Signals
                    .AsNoTracking()
                    .Where(s => relevantSignals.Contains(s.Name))
                    .Select(signal => new
                    {
                        signal.Name,
                        signal.Accuracy,
                        signal.Type,
                        signal.PrevFinalized,
                        signal.NextFinalized,
                        signal.PrevRegex,
                        signal.NextRegex,
                        PrevSignalConnections = signal.PrevSignalConnections.Select(c => new { c.Prev, c.VMAX }),
                        NextSignalConnections = signal.NextSignalConnections.Select(c => new { c.Next, c.VMAX })
                    })
                    .ToListAsync())
            .Select(s => new MinimalSignalData(
                s.Name,
                s.Accuracy,
                s.Type,
                s.PrevFinalized,
                s.NextFinalized,
                s.PrevRegex,
                s.NextRegex,
                s.PrevSignalConnections.Select(c => new MinimalSignalData.SignalConnection(c.Prev, c.VMAX)).ToList(),
                s.NextSignalConnections.Select(c => new MinimalSignalData.SignalConnection(c.Next, c.VMAX)).ToList()))
            .ToList();

        var signalLookup = signals.ToDictionary(s => s.Name);

        // Important: as these are all the trains in every server, one signal can change multiple times
        foreach (var train in allTrains)
        {
            if (train.TrainData.Latitude is null || train.TrainData.Longitude is null)
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

            InvalidTrainsGauge.WithLabels(serverCode).Set(count);


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
                    "New signal detected: {SignalId} at {Latitude}, {Longitude} ({Extra}) with accuracy {DistanceToSignalInFront}m at train {TrainId}",
                    signalId, train.TrainData.Latitude, train.TrainData.Longitude, extra,
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
        // check if train was stopped at the previous signal
        if (prevSignalData.SignalSpeed == 0)
        {
            _logger.LogWarning(
                "Train {TrainId} ({TrainType}) reached signal {SignalId} from stop signal {PrevSignalId}, ignoring connection!",
                train.GetTrainId(), train.Type, signal.Name, prevSignalData.SignalName);
            return false;
        }

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
}