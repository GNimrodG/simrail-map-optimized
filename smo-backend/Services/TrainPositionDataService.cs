using Prometheus;
using SMOBackend.Models;
using SMOBackend.Models.Trains;

namespace SMOBackend.Services;

public class TrainPositionDataService(
    ILogger<TrainPositionDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient) : BaseServerDataService<TrainPosition[]>("TRAIN-POS", logger, scopeFactory, serverDataService)
{
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(1);

    protected override Task<TrainPosition[]> FetchServerData(string serverCode, CancellationToken stoppingToken) =>
        apiClient.GetTrainPositionsAsync(serverCode, stoppingToken);
    
    public void ApplyToTrains(Train[] trains)
    {
        foreach (var train in trains)
        {
            var trainPosData = this[train.ServerCode]?.FirstOrDefault(t => t.Id == train.Id);
            trainPosData?.ApplyTo(train);
        }
    }

    protected override void OnPerServerDataReceived(PerServerData<TrainPosition[]> data)
    {
        base.OnPerServerDataReceived(data);

        TrainCountGauge.WithLabels(data.ServerCode).Set(data.Data.Length);
        TrainAvgSpeedGauge.WithLabels(data.ServerCode)
            .Set(data.Data.Length > 0 ? data.Data.Average(train => train.Velocity) : 0);
    }

    private static readonly Gauge TrainCountGauge = Metrics
        .CreateGauge("smo_train_count", "Number of trains on the server", "server");

    private static readonly Gauge TrainAvgSpeedGauge = Metrics
        .CreateGauge("smo_train_avg_speed", "Average speed of trains on the server", "server");
}