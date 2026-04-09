using System.Diagnostics;
using Prometheus;
using SMOBackend.Analytics;
using SMOBackend.Models.Trains;
using SMOBackend.Services.ApiClients;
using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
/// Service for fetching and processing train data.
/// </summary>
public partial class TrainDataService(
    ILogger<TrainDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient,
    TrainTypeService trainTypeService)
    : BaseServerDataService<Train[]>("TRAIN", logger, scopeFactory, serverDataService),
        IServerMetricsCleaner
{
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "train-consists");
    private static readonly string TrainConsistsFile = Path.Combine(DataDirectory, "train-consists.bin");

    private static readonly Gauge PlayerTrainCountGauge = Metrics
        .CreateGauge("smo_player_train_count", "Number of trains on the server that are controlled by a player",
            "server");

    private readonly TtlCache<string, string[]> _lastConsistCache =
        new(TimeSpan.FromHours(24), "LastConsistCache", 50000);

    private readonly int _phaseTimingLogThresholdMs = StdUtils.GetEnvVar("TRAIN_PHASE_TIMING_LOG_THRESHOLD_MS", 250);

    private TimedFunction? _autoSaveFunction;

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(5);

    /// <inheritdoc />
    public void ClearServerMetrics(string serverCode)
    {
        // Clear player train count metrics for the offline server
        PlayerTrainCountGauge.RemoveLabelledByPredicate(labels => labels.Length > 0 && labels[0] == serverCode);
    }

    /// <inheritdoc />
    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            Directory.CreateDirectory(DataDirectory);
            if (File.Exists(TrainConsistsFile))
            {
                _lastConsistCache.LoadFromFile(TrainConsistsFile);
                logger.LogInformation("Loaded {Count} train consists from {FilePath}",
                    _lastConsistCache.Count, TrainConsistsFile);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to load train consists from file");
        }

        _autoSaveFunction = new(SaveTrainConsists, TimeSpan.FromMinutes(5), cancellationToken);

        await base.StartAsync(cancellationToken);
    }

    /// <inheritdoc />
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _autoSaveFunction?.Dispose();

        await SaveTrainConsistsAsync().NoContext();
        await base.StopAsync(cancellationToken);
    }

    /// <inheritdoc />
    protected override async Task<Train[]> FetchServerData(string serverCode, CancellationToken stoppingToken)
    {
        var totalSw = Stopwatch.StartNew();

        var fetchSw = Stopwatch.StartNew();
        var trains = await apiClient.GetTrainsAsync(serverCode, stoppingToken);
        fetchSw.Stop();

        var batchTrainTypeCache = new Dictionary<string, string?>(StringComparer.Ordinal);

        var enrichSw = Stopwatch.StartNew();
        // Populate TrainType for each train
        foreach (var train in trains)
        {
            if (!batchTrainTypeCache.TryGetValue(train.TrainNoLocal, out var trainType))
            {
                trainType = trainTypeService.GetTrainType(train.TrainNoLocal);
                batchTrainTypeCache[train.TrainNoLocal] = trainType;
            }

            train.TrainType = trainType;
        }

        enrichSw.Stop();

        totalSw.Stop();
        LogTrainFetchPhases(serverCode, trains.Length, fetchSw.ElapsedMilliseconds, enrichSw.ElapsedMilliseconds,
            totalSw.ElapsedMilliseconds);

        return trains;
    }

    /// <inheritdoc />
    protected override void OnPerServerDataReceived(PerServerData<Train[]> data)
    {
        var totalSw = Stopwatch.StartNew();

        var dispatchSw = Stopwatch.StartNew();
        base.OnPerServerDataReceived(data);
        dispatchSw.Stop();

        var postProcessSw = Stopwatch.StartNew();
        var playerTrainCount = 0;

        foreach (var train in data.Data)
        {
            if (string.IsNullOrWhiteSpace(train.TrainNoLocal) || train.Vehicles.Length == 0)
            {
                if (train.Type == "user")
                    playerTrainCount++;

                continue;
            }

            var cacheKey = GetConsistCacheKey(data.ServerCode, train.TrainNoLocal);

            if (_lastConsistCache.TryGetValue(cacheKey, out var existingConsist) &&
                existingConsist.Length == train.Vehicles.Length &&
                existingConsist.SequenceEqual(train.Vehicles))
            {
                if (train.Type == "user")
                    playerTrainCount++;

                continue;
            }

            _lastConsistCache.Set(cacheKey, train.Vehicles);

            if (train.Type == "user")
                playerTrainCount++;
        }

        postProcessSw.Stop();

        PlayerTrainCountGauge.WithLabels(data.ServerCode)
            .Set(playerTrainCount);

        totalSw.Stop();
        LogTrainDispatchPhases(data.ServerCode, data.Data.Length, dispatchSw.ElapsedMilliseconds,
            postProcessSw.ElapsedMilliseconds, totalSw.ElapsedMilliseconds);
    }

    private void LogTrainFetchPhases(string serverCode, int trainCount, long fetchMs, long enrichMs, long totalMs)
    {
        if (totalMs < _phaseTimingLogThresholdMs) return;

        if (totalMs >= 1000)
            logger.LogInformation(
                "TRAIN fetch phases for {ServerCode}: fetch={FetchMs}ms enrich={EnrichMs}ms total={TotalMs}ms trains={TrainCount}",
                serverCode, fetchMs, enrichMs, totalMs, trainCount);
        else
            LogTrainDebugFetchPhasesForServer(serverCode, fetchMs, enrichMs, totalMs, trainCount);
    }

    private void LogTrainDispatchPhases(string serverCode, int trainCount, long dispatchMs, long postProcessMs,
        long totalMs)
    {
        if (totalMs < _phaseTimingLogThresholdMs) return;

        if (totalMs >= 1000)
            logger.LogInformation(
                "TRAIN dispatch phases for {ServerCode}: eventDispatch={DispatchMs}ms postProcess={PostProcessMs}ms total={TotalMs}ms trains={TrainCount}",
                serverCode, dispatchMs, postProcessMs, totalMs, trainCount);
        else
            LogTrainDebugDispatchPhasesForServer(serverCode, dispatchMs, postProcessMs, totalMs, trainCount);
    }

    /// <summary>
    ///     Gets the last known consist for a train on a specific server.
    /// </summary>
    public string[]? GetLastConsist(string serverCode, string trainNoLocal)
    {
        return _lastConsistCache.TryGetValue(GetConsistCacheKey(serverCode, trainNoLocal), out var consist)
            ? consist
            : null;
    }

    private static string GetConsistCacheKey(string serverCode, string trainNoLocal)
    {
        return $"{trainNoLocal}@{serverCode}";
    }

    private void SaveTrainConsists()
    {
        try
        {
            _lastConsistCache.SaveToFileAsync(TrainConsistsFile).Wait();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to save train consists to file");
        }
    }

    private async Task SaveTrainConsistsAsync()
    {
        try
        {
            await _lastConsistCache.SaveToFileAsync(TrainConsistsFile).NoContext();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to save train consists to file");
        }
    }

    [LoggerMessage(LogLevel.Debug,
        "TRAIN dispatch phases for {ServerCode}: eventDispatch={DispatchMs}ms postProcess={PostProcessMs}ms total={TotalMs}ms trains={TrainCount}")]
    partial void LogTrainDebugDispatchPhasesForServer(string serverCode, long dispatchMs, long postProcessMs,
        long totalMs, int trainCount);

    [LoggerMessage(LogLevel.Debug,
        "TRAIN fetch phases for {ServerCode}: fetch={FetchMs}ms enrich={EnrichMs}ms total={TotalMs}ms trains={TrainCount}")]
    partial void LogTrainDebugFetchPhasesForServer(string serverCode, long fetchMs, long enrichMs, long totalMs,
        int trainCount);
}