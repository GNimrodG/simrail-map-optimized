using Prometheus;
using SMOBackend.Models.Trains;

namespace SMOBackend.Services;

/// <summary>
/// Service for fetching and processing train data.
/// </summary>
public class TrainDataService(
    ILogger<TrainDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient) : BaseServerDataService<Train[]>("TRAIN", logger, scopeFactory, serverDataService)
{
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(5);

    protected override Task<Train[]> FetchServerData(string serverCode, CancellationToken stoppingToken) =>
        apiClient.GetTrainsAsync(serverCode, stoppingToken);

    protected override void OnPerServerDataReceived(PerServerData<Train[]> data)
    {
        base.OnPerServerDataReceived(data);

        PlayerTrainCountGauge.WithLabels(data.ServerCode)
            .Set(data.Data.Count(train => train.TrainData.ControlledBySteamID != null));
    }

    private static readonly Gauge PlayerTrainCountGauge = Metrics
        .CreateGauge("smo_player_train_count", "Number of trains on the server that are controlled by a player",
            "server");
}