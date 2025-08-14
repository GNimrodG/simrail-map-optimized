using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SMOBackend.Utils;

namespace SMOBackend.Models.Entity;

[Table("signal_connections")]
[PrimaryKey(nameof(Prev), nameof(Next))]
[Index(nameof(Prev), IsUnique = false)]
[Index(nameof(Next), IsUnique = false)]
public class SignalConnection : BaseEntity
{
    public SignalConnection()
    {
    }

    public SignalConnection(string prev, string next, short? vmax, string trainId)
    {
        if (string.IsNullOrWhiteSpace(prev))
            throw new ArgumentNullException(nameof(prev), "Previous signal name cannot be null or empty.");
        if (string.IsNullOrWhiteSpace(next))
            throw new ArgumentNullException(nameof(next), "Next signal name cannot be null or empty.");
        if (string.IsNullOrWhiteSpace(trainId))
            throw new ArgumentNullException(nameof(trainId), "Train ID cannot be null or empty.");
        if (vmax < 0)
            throw new ArgumentOutOfRangeException(nameof(vmax), "VMAX cannot be negative.");
        if (prev == next)
            throw new ArgumentException("Previous and next signals cannot be the same.", nameof(prev));
        if (prev.Length > StdUtils.SignalNameLength)
            throw new ArgumentException(
                $"Previous signal name cannot exceed {StdUtils.SignalNameLength} characters.",
                nameof(prev));
        if (next.Length > StdUtils.SignalNameLength)
            throw new ArgumentException($"Next signal name cannot exceed {StdUtils.SignalNameLength} characters.",
                nameof(next));

        Prev = prev;
        Next = next;
        VMAX = vmax;
        CreatedBy = trainId;
    }

    [MaxLength(StdUtils.SignalNameLength)] public string Prev { get; set; }

    [MaxLength(StdUtils.SignalNameLength)] public string Next { get; set; }

    [Column(TypeName = "DOUBLE PRECISION")]
    public float Distance { get; set; }

    public short? VMAX { get; set; }

    public Signal PrevSignal { get; set; }

    public Signal NextSignal { get; set; }

    /// <inheritdoc />
    public override string ToString() =>
        $"{Prev} -> {Next} ({(VMAX == short.MaxValue ? "VMAX" : VMAX)} km/h) by {CreatedBy ?? "unknown"}";
}