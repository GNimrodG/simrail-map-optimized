using Prometheus;
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
    SimrailApiClient apiClient) : BaseServerDataService<Train[]>("TRAIN", logger, scopeFactory, serverDataService),
    IServerMetricsCleaner
{
    private static readonly Gauge PlayerTrainCountGauge = Metrics
        .CreateGauge("smo_player_train_count", "Number of trains on the server that are controlled by a player",
            "server");

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(5);

    /// <inheritdoc />
    protected override Task<Train[]> FetchServerData(string serverCode, CancellationToken stoppingToken) =>
        apiClient.GetTrainsAsync(serverCode, stoppingToken);

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