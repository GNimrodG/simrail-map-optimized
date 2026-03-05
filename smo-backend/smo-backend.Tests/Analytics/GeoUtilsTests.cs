using FluentAssertions;
using NetTopologySuite.Geometries;
using SMOBackend.Analytics;

namespace SMOBackend.Tests.Analytics;

/// <summary>
///     Unit tests for <see cref="GeoUtils" />.
/// </summary>
public class GeoUtilsTests
{
    // ──────────────────────────────────────────────
    //  HaversineDistance Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void HaversineDistance_BetweenSamePoint_ReturnsZero()
    {
        var point1 = new Point(19.0, 51.0) { SRID = 4326 };
        var point2 = new Point(19.0, 51.0) { SRID = 4326 };

        var distance = point1.HaversineDistance(point2);

        distance.Should().BeApproximately(0, 0.1);
    }

    [Fact]
    public void HaversineDistance_BetweenKnownPoints_ReturnsCorrectDistance()
    {
        // Warsaw (52.2297, 21.0122) to Krakow (50.0647, 19.9450)
        // Expected distance: approximately 252 km = 252,000 meters
        var warsaw = new Point(21.0122, 52.2297) { SRID = 4326 };
        var krakow = new Point(19.9450, 50.0647) { SRID = 4326 };

        var distance = warsaw.HaversineDistance(krakow);

        distance.Should().BeApproximately(252_000, 5000); // Allow 5km margin
    }

    [Fact]
    public void HaversineDistance_BetweenClosePoints_ReturnsSmallDistance()
    {
        // Two points 1km apart (approximately)
        var point1 = new Point(19.0, 51.0) { SRID = 4326 };
        var point2 = new Point(19.01, 51.0) { SRID = 4326 };

        var distance = point1.HaversineDistance(point2);

        distance.Should().BeApproximately(755, 100); // Approximately 755 meters
    }

    [Fact]
    public void HaversineDistance_WithLatLonParameters_CalculatesCorrectly()
    {
        var distance = GeoUtils.HaversineDistance(51.0, 19.0, 51.0, 19.0);

        distance.Should().BeApproximately(0, 0.1);
    }

    [Fact]
    public void HaversineDistance_WithLatLonParameters_BetweenKnownPoints_ReturnsCorrectDistance()
    {
        // Warsaw to Krakow
        var distance = GeoUtils.HaversineDistance(52.2297, 21.0122, 50.0647, 19.9450);

        distance.Should().BeApproximately(252_000, 5000);
    }

    [Fact]
    public void HaversineDistance_IsSymmetric()
    {
        var point1 = new Point(19.0, 51.0) { SRID = 4326 };
        var point2 = new Point(20.0, 52.0) { SRID = 4326 };

        var distance1 = point1.HaversineDistance(point2);
        var distance2 = point2.HaversineDistance(point1);

        distance1.Should().BeApproximately(distance2, 0.1);
    }

    [Theory]
    [InlineData(0, 0, 0, 90, 10_000_000)] // Quarter of Earth circumference
    [InlineData(0, 0, 0, 180, 20_000_000)] // Half of Earth circumference
    public void HaversineDistance_ForLargeDistances_ReturnsReasonableValues(
        double lat1, double lon1, double lat2, double lon2, double expectedMeters)
    {
        var distance = GeoUtils.HaversineDistance(lat1, lon1, lat2, lon2);

        // Allow 10% margin for approximation
        distance.Should().BeApproximately(expectedMeters, expectedMeters * 0.1);
    }

    // ──────────────────────────────────────────────
    //  CatmullRomSpline Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void CatmullRomSpline_WithLessThanTwoPoints_ReturnsEmpty()
    {
        var points = new List<Coordinate> { new(0, 0) };

        var result = GeoUtils.CatmullRomSplineToLineString(points, 10);

        result.Coordinates.Should().BeEmpty();
    }

    [Fact]
    public void CatmullRomSpline_WithTwoPoints_ReturnsLineString()
    {
        var points = new List<Coordinate>
        {
            new(0, 0),
            new(1, 1)
        };

        var result = GeoUtils.CatmullRomSplineToLineString(points, 10);

        result.Coordinates.Should().NotBeEmpty();
        result.Coordinates.First().Should().Be(points[0]);
        result.Coordinates.Last().Should().Be(points[1]);
    }

    [Fact]
    public void CatmullRomSpline_WithThreePoints_CreatesSmoothCurve()
    {
        var points = new List<Coordinate>
        {
            new(0, 0),
            new(1, 1),
            new(2, 0)
        };

        var result = GeoUtils.CatmullRomSplineToLineString(points, 10);

        // Should have more points than input (interpolated)
        result.Coordinates.Length.Should().BeGreaterThan(points.Count);

        // Should start and end at the original points
        result.Coordinates.First().Should().Be(points[0]);
        result.Coordinates.Last().Should().Be(points[^1]);
    }

    [Fact]
    public void CatmullRomSpline_SegmentsPerCurve_AffectsOutputSize()
    {
        var points = new List<Coordinate>
        {
            new(0, 0),
            new(1, 1),
            new(2, 0)
        };

        var result10 = GeoUtils.CatmullRomSplineToLineString(points, 10);
        var result20 = GeoUtils.CatmullRomSplineToLineString(points, 20);

        // More segments should produce more points
        result20.Coordinates.Length.Should().BeGreaterThan(result10.Coordinates.Length);
    }
}