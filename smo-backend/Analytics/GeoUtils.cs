using System.Numerics;
using NetTopologySuite.Geometries;

namespace SMOBackend.Analytics;

/// <summary>
///   Utility class for geographical calculations.
/// </summary>
public static class GeoUtils
{
    private const double EarthRadiusMeters = 6371000; // Earth radius in meters


    /// <summary>
    ///   Calculate the Haversine distance between two points on Earth.
    /// </summary>
    /// <returns>Distance in meters</returns>
    public static double HaversineDistance(this Point point1, Point point2) =>
        HaversineDistance(point1.Y, point1.X, point2.Y, point2.X);

    /// <summary>
    ///   Calculate the Haversine distance between two points on Earth.
    /// </summary>
    /// <returns>Distance in meters</returns>
    public static double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
    {
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return EarthRadiusMeters * c; // Distance in meters
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180.0;

    public static LineString CatmullRomSplineToLineString(List<Coordinate> points, int segmentsPerCurve)
    {
        var splinePoints = CatmullRomSpline(points.Select(p => new Vector2((float)p.X, (float)p.Y)).ToList(),
            segmentsPerCurve);
        return new(splinePoints.Select(p => new Coordinate(p.X, p.Y)).ToArray());
    }

    /// <summary>
    /// Generates a Catmull-Rom spline from a list of points.
    /// </summary>
    /// <param name="points">List of control points for the spline</param>
    /// <param name="segmentsPerCurve">Number of segments to divide each curve into</param>
    /// <returns>a list of points along the Catmull-Rom spline</returns>
    public static List<Vector2> CatmullRomSpline(List<Vector2> points, int segmentsPerCurve)
    {
        var result = new List<Vector2>();

        if (points.Count < 2)
            return result;

        // Duplicate the endpoints so the spline passes through the end points
        var pts = new List<Vector2>
        {
            points[0]
        };
        pts.AddRange(points);
        pts.Add(points[^1]);

        for (var i = 0; i < pts.Count - 3; i++)
        {
            var p0 = pts[i];
            var p1 = pts[i + 1];
            var p2 = pts[i + 2];
            var p3 = pts[i + 3];

            for (var j = 0; j < segmentsPerCurve; j++)
            {
                var t = (float)j / segmentsPerCurve;
                var point = GetCatmullRomPosition(t, p0, p1, p2, p3);
                result.Add(point);
            }
        }

        // Add the last original point
        result.Add(points[points.Count - 1]);
        return result;
    }

    // Catmull-Rom interpolation formula
    private static Vector2 GetCatmullRomPosition(float t, Vector2 p0, Vector2 p1, Vector2 p2, Vector2 p3)
    {
        var t2 = t * t;
        var t3 = t2 * t;

        return 0.5f * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }
}