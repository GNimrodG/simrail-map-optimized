namespace SMOBackend.Models;

/// <summary>
/// Unusual cargo flags of a train from the EDR timetable.
/// </summary>
/// <param name="IsQualityTracked">If the train is quality tracked</param>
/// <param name="IsOverGauge">If the train has over-gauged vehicles</param>
/// <param name="IsOverWeight">If the train is overweight</param>
/// <param name="IsOtherExceptional">If the train has other exceptional characteristics</param>
/// <param name="IsHighRiskCargo">If the train has high risk cargo</param>
/// <param name="IsDangerousCargo">If the train has dangerous cargo</param>
public sealed record UnusualCargo(
    bool IsQualityTracked,
    bool IsOverGauge,
    bool IsOverWeight,
    bool IsOtherExceptional,
    bool IsHighRiskCargo,
    bool IsDangerousCargo)
{
    /// <summary>
    /// No unusual cargo.
    /// </summary>
    public static readonly UnusualCargo None = new(false, false, false, false, false, false);

    /// <summary>
    /// Gets the unusual cargo flags of an EDR timetable entry.
    /// </summary>
    public static UnusualCargo FromEdr(EdrTimetableTrainEntry entry) => new(
        entry.IsQualityTracked,
        entry.IsOverGauge,
        entry.IsOverWeight ?? false,
        entry.IsOtherExceptional,
        entry.IsHighRiskCargo,
        entry.IsDangerousCargo);
}
