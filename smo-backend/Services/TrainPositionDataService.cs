using Prometheus;
using SMOBackend.Models;
using SMOBackend.Models.Trains;
using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
///     Service for fetching and managing train position data from the server.
/// </summary>
public class TrainPositionDataService(
    ILogger<TrainPositionDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient)
    : BaseServerDataService<TrainPosition[]>("TRAIN-POS", logger, scopeFactory, serverDataService),
        IServerMetricsCleaner
{
    private static readonly Gauge TrainCountGauge = Metrics
        .CreateGauge("smo_train_count", "Number of trains on the server", "server");

    private static readonly Gauge TrainAvgSpeedGauge = Metrics
        .CreateGauge("smo_train_avg_speed", "Average speed of trains on the server", "server");

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(1);

    /// <inheritdoc />
    protected override Task<TrainPosition[]> FetchServerData(string serverCode, CancellationToken stoppingToken) =>
        apiClient.GetTrainPositionsAsync(serverCode, stoppingToken);

    /// <summary>
    ///     Applies the train position data to the given trains.
    /// </summary>
    /// <param name="trains"> The trains to apply the data to.</param>
    public void ApplyToTrains(Train[] trains)
    {
        foreach (var train in trains)
        {
            var trainPosData = this[train.ServerCode]?.FirstOrDefault(t => t.Id == train.Id);
            trainPosData?.ApplyTo(train);
        }
    }

    /// <inheritdoc />
    protected override void OnDataReceived(Dictionary<string, TrainPosition[]> data)
    {
        base.OnDataReceived(data);

        TrainCountGauge.Clear();
        TrainAvgSpeedGauge.Clear();

        foreach (var (server, trains) in data)
        {
            if (trains.Length == 0)
                continue;

            TrainCountGauge.WithLabels(server).Set(trains.Length);
            TrainAvgSpeedGauge.WithLabels(server)
                .Set(trains.Length > 0 ? trains.Average(train => train.Velocity) : 0);
        }
    }

    /// <inheritdoc />
    public void ClearServerMetrics(string serverCode)
    {
        // Clear train count metrics for the offline server
        TrainCountGauge.RemoveLabelledByPredicate(labels => labels.Length > 0 && labels[0] == serverCode);

        // Clear train average speed metrics for the offline server
        TrainAvgSpeedGauge.RemoveLabelledByPredicate(labels => labels.Length > 0 && labels[0] == serverCode);
    }
}