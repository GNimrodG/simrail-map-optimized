namespace SMOBackend.Models;

/// <summary>
/// The part of an EDR timetable entry needed for the unusual cargo flags. Deserializing only these fields lets
/// </summary>
public class EdrTrainUnusualCargo
{
    /// <inheritdoc cref="EdrTimetableTrainEntry.TrainNoLocal"/>
    public required string TrainNoLocal { get; set; }

    /// <inheritdoc cref="EdrTimetableTrainEntry.IsQualityTracked"/>
    public bool IsQualityTracked { get; set; }

    /// <inheritdoc cref="EdrTimetableTrainEntry.IsOverGauge"/>
    public bool IsOverGauge { get; set; }

    /// <inheritdoc cref="EdrTimetableTrainEntry.IsOverWeight"/>
    public bool? IsOverWeight { get; set; }

    /// <inheritdoc cref="EdrTimetableTrainEntry.IsOtherExceptional"/>
    public bool IsOtherExceptional { get; set; }

    /// <inheritdoc cref="EdrTimetableTrainEntry.IsHighRiskCargo"/>
    public bool IsHighRiskCargo { get; set; }

    /// <inheritdoc cref="EdrTimetableTrainEntry.IsDangerousCargo"/>
    public bool IsDangerousCargo { get; set; }

    /// <summary>
    /// Gets the unusual cargo flags of the train.
    /// </summary>
    public UnusualCargo ToUnusualCargo()
    {
        var cargo = UnusualCargo.None;
        if (IsQualityTracked) cargo |= UnusualCargo.QualityTracked;
        if (IsOverGauge) cargo |= UnusualCargo.OverGauge;
        if (IsOverWeight == true) cargo |= UnusualCargo.OverWeight;
        if (IsOtherExceptional) cargo |= UnusualCargo.OtherExceptional;
        if (IsHighRiskCargo) cargo |= UnusualCargo.HighRiskCargo;
        if (IsDangerousCargo) cargo |= UnusualCargo.DangerousCargo;
        return cargo;
    }
}
