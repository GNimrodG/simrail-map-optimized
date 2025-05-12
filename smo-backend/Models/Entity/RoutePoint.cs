using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using SMOBackend.Models.Trains;

namespace SMOBackend.Models.Entity;

[Table("route_points")]
[Index(nameof(RouteId), IsUnique = false)]
[Index(nameof(RouteId), nameof(RunId), nameof(TrainId), IsUnique = false)]
public class RoutePoint
{
    [Key, DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    /// <summary>
    /// Route ID (TrainNoLocal) of the train.
    /// </summary>
    [MaxLength(8)]
    public string RouteId { get; set; } // 123456 (TrainNoLocal)

    /// <summary>
    /// Run ID of the train.
    /// </summary>
    [MaxLength(36)]
    public string RunId { get; set; } // cfcc209f-4a88-422f-a27d-71e7264acded

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
    /// Created at timestamp of the route point.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    internal RoutePoint(Train train)
    {
        ArgumentNullException.ThrowIfNull(train.TrainData.Location);

        RouteId = train.TrainNoLocal;
        RunId = train.RunId;
        TrainId = train.Id;
        Point = train.TrainData.Location;
    }

    internal RoutePoint(Train train, Point point)
    {
        RouteId = train.TrainNoLocal;
        RunId = train.RunId;
        TrainId = train.Id;
        Point = point;
    }

    public RoutePoint(string routeId, string runId, string trainId, Point point)
    {
        RouteId = routeId;
        RunId = runId;
        TrainId = trainId;
        Point = point;
    }
}