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

    /// <summary>
    ///     Minimum distance a train has to move before its heading is recalculated (filters out standing trains).
    /// </summary>
    private const double HeadingMinDistanceMeters = 5;

    /// <summary>
    ///     Moving further than this between two positions is treated as a jump (e.g. respawn), not as travel.
    /// </summary>
    private const double HeadingMaxDistanceMeters = 1000;

    private readonly ConcurrentDictionary<string, IReadOnlyDictionary<string, HeadingAnchor>> _headingAnchors = new();

    private readonly ConcurrentDictionary<string, IReadOnlyDictionary<string, TrainPosition>> _trainPositionIndex =
        new();

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(1);

    /// <inheritdoc />
    public void ClearServerMetrics(string serverCode)
    {
        _trainPositionIndex.TryRemove(serverCode, out _);
        _headingAnchors.TryRemove(serverCode, out _);

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
    protected override void OnPerServerDataReceived(PerServerData<TrainPosition[]> data)
    {
        _headingAnchors[data.ServerCode] =
            ApplyHeadings(data.Data, _headingAnchors.GetValueOrDefault(data.ServerCode));

        // Update the index before the positions are sent to clients, so train data sent afterwards
        // (see ApplyToTrains) never carries an older position than the clients already have
        _trainPositionIndex[data.ServerCode] = data.Data
            .GroupBy(t => t.Id)
            .ToDictionary(g => g.Key, g => g.First());

        base.OnPerServerDataReceived(data);
    }

    /// <summary>
    ///     Sets <see cref="TrainPosition.Heading" /> from the train's movement since its last anchor point.
    /// </summary>
    /// <remarks>
    ///     The heading is only recalculated once a train moved at least <see cref="HeadingMinDistanceMeters" /> from the
    ///     anchor, so standing or crawling trains keep their last heading instead of jittering.
    ///     Trains that are no longer in <paramref name="positions" /> are dropped from the returned anchors.
    /// </remarks>
    /// <param name="positions">The latest positions of one server, updated in place.</param>
    /// <param name="previousAnchors">The anchors returned for the previous positions of the same server.</param>
    /// <returns>The anchors to pass in with the next positions.</returns>
    internal static IReadOnlyDictionary<string, HeadingAnchor> ApplyHeadings(TrainPosition[] positions,
        IReadOnlyDictionary<string, HeadingAnchor>? previousAnchors)
    {
        var anchors = new Dictionary<string, HeadingAnchor>(positions.Length);

        foreach (var position in positions)
        {
            HeadingAnchor? previous = previousAnchors != null &&
                                      previousAnchors.TryGetValue(position.Id, out var found)
                ? found
                : null;

            if (position.Latitude is not { } latitude || position.Longitude is not { } longitude)
            {
                // no position this time, keep what we know
                position.Heading = previous?.Heading;
                if (previous != null) anchors[position.Id] = previous.Value;
                continue;
            }

            if (previous == null)
            {
                anchors[position.Id] = new(latitude, longitude, null);
                continue;
            }

            var anchor = previous.Value;

            // equirectangular approximation, accurate enough for the few hundred metres between two positions
            var dx = (longitude - anchor.Longitude) * Math.Cos(anchor.Latitude * Math.PI / 180) * 111_320;
            var dy = (latitude - anchor.Latitude) * 110_540;
            var distanceSquared = dx * dx + dy * dy;

            if (distanceSquared > HeadingMaxDistanceMeters * HeadingMaxDistanceMeters)
            {
                anchor = new(latitude, longitude, null);
            }
            else if (distanceSquared >= HeadingMinDistanceMeters * HeadingMinDistanceMeters)
            {
                var degrees = (short)Math.Round(Math.Atan2(dx, dy) * 180 / Math.PI);
                anchor = new(latitude, longitude, (short)((degrees + 360) % 360));
            }

            position.Heading = anchor.Heading;
            anchors[position.Id] = anchor;
        }

        return anchors;
    }

    /// <summary>
    ///     The last point a train's heading was calculated at.
    /// </summary>
    internal readonly record struct HeadingAnchor(double Latitude, double Longitude, short? Heading);

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
}