using Prometheus;
using SMOBackend.Analytics;
using SMOBackend.Models.Trains;
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
    private static readonly Gauge PlayerTrainCountGauge = Metrics
        .CreateGauge("smo_player_train_count", "Number of trains on the server that are controlled by a player",
            "server");

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(5);

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

        PlayerTrainCountGauge.WithLabels(data.ServerCode)
            .Set(data.Data.Count(train => train.TrainData.ControlledBySteamID != null));
    }

    /// <inheritdoc />
    public void ClearServerMetrics(string serverCode)
    {
        // Clear player train count metrics for the offline server
        PlayerTrainCountGauge.RemoveLabelledByPredicate(labels => labels.Length > 0 && labels[0] == serverCode);
    }
}