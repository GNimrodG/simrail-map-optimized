using FluentAssertions;
using NetTopologySuite.Geometries;
using SMOBackend.Analytics;
using SMOBackend.Models.Entity;

namespace SMOBackend.Tests.Analytics;

/// <summary>
///     Tests for splitting route lines at gaps (<see cref="RoutePointAnalyzerService.SplitPointsAtGaps" />).
/// </summary>
public class RoutePointGapSplitTests
{
    // the default ROUTE_POINT_MAX_GAP_METERS
    private const double MaxGap = 1000;

    // ~1 m of latitude in degrees
    private const double Meter = 1 / 111_195.0;

    private static readonly DateTime Start = new(2026, 10, 13, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>
    ///     Route points going north from 52°N, <paramref name="spacings" /> meters apart, one every 5 s.
    /// </summary>
    private static List<RoutePoint> PointsWithSpacings(params double[] spacings)
    {
        var lat = 52.0;
        var points = new List<RoutePoint> { Point(lat, 0) };

        for (var i = 0; i < spacings.Length; i++)
        {
            lat += spacings[i] * Meter;
            points.Add(Point(lat, i + 1));
        }

        return points;

        static RoutePoint Point(double lat, int index) =>
            new("12345", "run", "train", new Point(19.0, lat) { SRID = 4326 }) { CreatedAt = Start.AddSeconds(index * 5) };
    }

    [Fact]
    public void FastTrain_IsNotSplit()
    {
        // 250 km/h with a point every 5 s is ~350 m, late ticks put points up to ~700 m apart
        var points = PointsWithSpacings(350, 347, 360, 700, 340, 355, 650, 350);

        var segments = RoutePointAnalyzerService.SplitPointsAtGaps(points, MaxGap);

        segments.Should().ContainSingle().Which.Should().HaveCount(points.Count);
    }

    [Fact]
    public void MissingData_SplitsTheLine()
    {
        var points = PointsWithSpacings(300, 300, 300, 8000, 300, 300);

        var segments = RoutePointAnalyzerService.SplitPointsAtGaps(points, MaxGap);

        segments.Select(s => s.Count).Should().Equal(4, 3);
    }

    [Fact]
    public void LonePointBetweenGaps_IsDropped()
    {
        var points = PointsWithSpacings(300, 300, 5000, 5000, 300, 300);

        var segments = RoutePointAnalyzerService.SplitPointsAtGaps(points, MaxGap);

        segments.Select(s => s.Count).Should().Equal(3, 3);
    }
}
