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
    public static double HaversineDistance(this Point point1, Point point2)
    {
        return HaversineDistance(point1.Y, point1.X, point2.Y, point2.X);
    }

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
}