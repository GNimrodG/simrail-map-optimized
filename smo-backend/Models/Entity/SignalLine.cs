using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using SMOBackend.Utils;

namespace SMOBackend.Models.Entity;

[Table("signal_lines")]
[PrimaryKey(nameof(PrevSignal), nameof(NextSignal))]
public class SignalLine
{
    [MaxLength(StdUtils.SignalNameLength)] public string? PrevSignal { get; set; }

    [MaxLength(StdUtils.SignalNameLength)] public string? NextSignal { get; set; }

    [Column(TypeName = "Geometry(LineString, 4326)")]
    public LineString Line { get; set; }

    /// <summary>
    ///     The line is the track itself (pushed by hand from the railway map, POST signals/{signal}/next/{next}): it's
    ///     kept as it is, the trains' route points are neither merged into it nor replace it.
    /// </summary>
    public bool Finalized { get; set; }
}