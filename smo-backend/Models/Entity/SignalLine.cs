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
}