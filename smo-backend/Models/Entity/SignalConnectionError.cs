using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SMOBackend.Utils;

namespace SMOBackend.Models.Entity;

[Table("signal_connection_errors")]
[PrimaryKey(nameof(Prev), nameof(Next), nameof(Error))]
public class SignalConnectionError : BaseEntity
{
    public SignalConnectionError()
    {
    }

    public SignalConnectionError(string prev, string next, string error, string trainId, short vmax)
    {
        Prev = prev;
        Next = next;
        VMAX = vmax;
        Error = error;
        CreatedBy = trainId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    [MaxLength(StdUtils.SignalNameLength)] public string Prev { get; set; }

    [MaxLength(StdUtils.SignalNameLength)] public string Next { get; set; }

    public short VMAX { get; set; }

    [MaxLength(500)] public string Error { get; set; }

    [DefaultValue(false)] public bool Checked { get; set; } = false;

    [Column(TypeName = "DOUBLE PRECISION")]
    public float Distance { get; set; } = 0;
}