using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using SMOBackend.Models.Trains;
using SMOBackend.Utils;

namespace SMOBackend.Models.Entity;

/// <summary>
///     Represents a point in the route of a train.
/// </summary>
[Table("route_points")]
[Index(nameof(RouteId), IsUnique = false)]
[Index(nameof(RouteId), nameof(RunId), nameof(TrainId), IsUnique = false)]
[Index(nameof(RouteId), nameof(CreatedAt), IsUnique = false)]
public class RoutePoint
{
    private const int MaxRunIdLength = 43;

    internal RoutePoint(Train train, string? prevSignal)
    {
        ArgumentNullException.ThrowIfNull(train.TrainData.Location);

        RouteId = train.TrainNoLocal;
        RunId = train.RunId;
        TrainId = train.Id;
        Point = train.TrainData.Location;
        InsidePlayArea = !train.TrainData.InBorderStationArea;
        NextSignal = train.TrainData.GetSignal();
        ServerCode = train.ServerCode;
        PrevSignal = prevSignal;
    }

    /// <inheritdoc cref="RoutePoint" />
    public RoutePoint(string routeId, [MaxLength(MaxRunIdLength)] string runId, string trainId, Point point,
        bool insidePlayArea = false,
        string? nextSignal = null, string? prevSignal = null, string serverCode = "")
    {
        RouteId = routeId;
        RunId = runId;
        TrainId = trainId;
        Point = point;
        InsidePlayArea = insidePlayArea;
        NextSignal = nextSignal;
        PrevSignal = prevSignal;
        ServerCode = serverCode;
    }

    /// <summary>
    ///     Unique identifier for the route point.
    /// </summary>
    [Key]
    public long Id { get; set; }

    /// <summary>
    /// Route ID (TrainNoLocal) of the train.
    /// </summary>
    [MaxLength(8)]
    public string RouteId { get; set; } // 123456 (TrainNoLocal)

    /// <summary>
    /// Run ID of the train. (UUID format + segment index if applicable)
    /// </summary>
    [MaxLength(MaxRunIdLength)]
    public string RunId { get; set; } // cfcc209f-4a88-422f-a27d-71e7264acded_seg000

    /// <summary>
    /// ID of the train.
    /// </summary>
    [MaxLength(24)]
    public string TrainId { get; set; } // 67d3022824104a3b64ed182a

    /// <summary>
    /// Location of the train as a point in WGS 84 coordinate system.
    /// </summary>
    [Column(TypeName = "Geometry(Point, 4326)")]
    public Point Point { get; set; }

    /// <summary>
    ///     Indicates whether the train is inside the playable area of the map at this point.
    /// </summary>
    public bool InsidePlayArea { get; set; }

    /// <summary>
    ///     The next signal that the train will encounter, if any, at this point.
    /// </summary>
    [MaxLength(StdUtils.SignalNameLength)]
    public string? NextSignal { get; set; }

    /// <summary>
    ///     The previous signal that the train passed, if any, at this point.
    /// </summary>
    [MaxLength(StdUtils.SignalNameLength)]
    public string? PrevSignal { get; set; }

    /// <summary>
    ///     The server code of the train, if applicable.
    /// </summary>
    [MaxLength(5)]
    public string ServerCode { get; set; }

    /// <summary>
    /// Created at timestamp of the route point.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}