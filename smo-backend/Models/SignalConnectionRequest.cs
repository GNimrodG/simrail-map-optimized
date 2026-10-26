using NetTopologySuite.Geometries;
using SMOBackend.Analytics;

namespace SMOBackend.Models;

/// <summary>
/// A signal connection added by hand (the railway map's signal paths view, simrail-railmap tools/signal-paths), with
/// the track between the two signals as its line.
/// </summary>
public class SignalConnectionRequest : PasswordRequest
{
    /// <summary>
    /// The most points a line may have (a route of tens of kilometres at the game's track resolution).
    /// </summary>
    public const int MaxLinePoints = 20_000;

    /// <summary>
    /// The connection's speed limit in km/h (<see cref="short.MaxValue" />: unrestricted), null when it isn't known:
    /// the trains then learn it. An existing connection keeps its speed when this is null.
    /// </summary>
    public short? Vmax { get; set; }

    /// <summary>
    /// The track from the signal to the next one, as [longitude, latitude] points, null to leave the line as it is.
    /// </summary>
    public double[][]? Line { get; set; }

    /// <summary>
    /// What's wrong with the request, null when it's valid.
    /// </summary>
    public string? Validate()
    {
        if (Vmax is < 0)
            return "The speed can't be negative.";
        if (Line == null)
            return null;
        if (Line.Length is < 2 or > MaxLinePoints)
            return $"A line needs 2 to {MaxLinePoints} points.";
        if (Line.Any(p => p is not { Length: 2 } || p[0] is < -180 or > 180 || p[1] is < -90 or > 90 ||
                          double.IsNaN(p[0]) || double.IsNaN(p[1])))
            return "Every point of the line must be [longitude, latitude].";
        return null;
    }

    /// <summary>
    /// The line as a geometry (WGS 84), null when the request has none. Call <see cref="Validate" /> first.
    /// </summary>
    public LineString? ToLineString() =>
        Line == null ? null : new LineString(Line.Select(p => new Coordinate(p[0], p[1])).ToArray()) { SRID = 4326 };

    /// <summary>
    /// The length of a line in metres (along the ground).
    /// </summary>
    public static double LengthOf(LineString line)
    {
        var length = 0.0;
        for (var i = 1; i < line.NumPoints; i++)
            length += line.GetPointN(i - 1).HaversineDistance(line.GetPointN(i));
        return length;
    }
}
