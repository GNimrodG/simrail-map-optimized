using Prometheus;
using SMOBackend.Analytics;
using SMOBackend.Models.Trains;
using SMOBackend.Services.ApiClients;
using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
/// Service for fetching and processing train data.
/// </summary>
public class TrainDataService(
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
        var trains = await apiClient.GetTrainsAsync(serverCode, stoppingToken);

        // Populate TrainType for each train
        foreach (var train in trains)
            train.TrainType = trainTypeService.GetTrainType(train.TrainNoLocal);

        return trains;
    }

    /// <inheritdoc />
    protected override void OnPerServerDataReceived(PerServerData<Train[]> data)
    {
        base.OnPerServerDataReceived(data);

        foreach (var train in data.Data)
        {
            if (string.IsNullOrWhiteSpace(train.TrainNoLocal) || train.Vehicles.Length == 0)
                continue;

            _lastConsistCache.Set(GetConsistCacheKey(data.ServerCode, train.TrainNoLocal), train.Vehicles);
        }

        PlayerTrainCountGauge.WithLabels(data.ServerCode)
            .Set(data.Data.Count(train => train.Type == "user"));
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
}