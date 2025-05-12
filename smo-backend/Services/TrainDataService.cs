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
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(1);

    protected override Task<Train[]> FetchServerData(string serverCode, CancellationToken stoppingToken) =>
        apiClient.GetTrainsAsync(serverCode, stoppingToken);

    protected override void OnPerServerDataReceived(PerServerData<Train[]> data)
    {
        base.OnPerServerDataReceived(data);

        TrainCountGauge.WithLabels(data.ServerCode).Set(data.Data.Length);
        PlayerTrainCountGauge.WithLabels(data.ServerCode)
            .Set(data.Data.Count(train => train.TrainData.ControlledBySteamID != null));
        TrainAvgSpeedGauge.WithLabels(data.ServerCode)
            .Set(data.Data.Length > 0 ? data.Data.Average(train => train.TrainData.Velocity) : 0);
    }

    private static readonly Gauge TrainCountGauge = Metrics
        .CreateGauge("smo_train_count", "Number of trains on the server", "server");

    private static readonly Gauge PlayerTrainCountGauge = Metrics
        .CreateGauge("smo_player_train_count", "Number of trains on the server that are controlled by a player",
            "server");

    private static readonly Gauge TrainAvgSpeedGauge = Metrics
        .CreateGauge("smo_train_avg_speed", "Average speed of trains on the server", "server");
}