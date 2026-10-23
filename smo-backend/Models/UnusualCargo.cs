namespace SMOBackend.Models;

/// <summary>
/// Unusual cargo flags of a train from the EDR timetable, as a bit mask:
/// 1 = QualityTracked, 2 = OverGauge, 4 = OverWeight, 8 = OtherExceptional, 16 = HighRiskCargo, 32 = DangerousCargo.
/// Combined by adding the values, e.g. 48 = HighRiskCargo + DangerousCargo. 0 = none.
/// </summary>
[Flags]
public enum UnusualCargo : byte
{
    /// <summary>
    /// No unusual cargo
    /// </summary>
    None = 0,

    /// <summary>
    /// The train is quality tracked
    /// </summary>
    QualityTracked = 1 << 0,

    /// <summary>
    /// The train has over-gauged vehicles
    /// </summary>
    OverGauge = 1 << 1,

    /// <summary>
    /// The train is overweight
    /// </summary>
    OverWeight = 1 << 2,

    /// <summary>
    /// The train has other exceptional characteristics
    /// </summary>
    OtherExceptional = 1 << 3,

    /// <summary>
    /// The train has high risk cargo
    /// </summary>
    HighRiskCargo = 1 << 4,

    /// <summary>
    /// The train has dangerous cargo
    /// </summary>
    DangerousCargo = 1 << 5,
}
