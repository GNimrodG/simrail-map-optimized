using System.Collections.Concurrent;
using Prometheus;
using SMOBackend.Models;
using SMOBackend.Models.Trains;
using SMOBackend.Services.ApiClients;
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

    private readonly ConcurrentDictionary<string, IReadOnlyDictionary<string, TrainPosition>> _trainPositionIndex =
        new();

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(1);

    /// <inheritdoc />
    public void ClearServerMetrics(string serverCode)
    {
        _trainPositionIndex.TryRemove(serverCode, out _);

        // Clear train count metrics for the offline server
        TrainCountGauge.RemoveLabelledByPredicate(labels => labels.Length > 0 && labels[0] == serverCode);

        // Clear train average speed metrics for the offline server
        TrainAvgSpeedGauge.RemoveLabelledByPredicate(labels => labels.Length > 0 && labels[0] == serverCode);
    }

    /// <inheritdoc />
    protected override Task<TrainPosition[]> FetchServerData(string serverCode, CancellationToken stoppingToken) =>
        apiClient.GetTrainPositionsAsync(serverCode, stoppingToken);

    /// <summary>
    ///     Applies the train position data to the given trains.
    /// </summary>
    /// <param name="trains"> The trains to apply the data to.</param>
    public void ApplyToTrains(Train[] trains)
    {
        foreach (var serverGroup in trains.GroupBy(t => t.ServerCode))
        {
            if (!_trainPositionIndex.TryGetValue(serverGroup.Key, out var positionIndex))
                continue;

            foreach (var train in serverGroup)
                if (positionIndex.TryGetValue(train.Id, out var trainPosData))
                    trainPosData.ApplyTo(train);
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
            _trainPositionIndex[server] = trains
                .GroupBy(t => t.Id)
                .ToDictionary(g => g.Key, g => g.First());

            if (trains.Length == 0)
                continue;

            TrainCountGauge.WithLabels(server).Set(trains.Length);
            TrainAvgSpeedGauge.WithLabels(server)
                .Set(trains.Length > 0 ? trains.Average(train => train.Velocity) : 0);
        }
    }
}