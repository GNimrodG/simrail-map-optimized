namespace SMOBackend.Models;

/// <summary>
///     Represents the next probable restart time for a server.
/// </summary>
public class ServerRestartPrediction(string serverCode, DateTime? nextProbableRestartTime, double? confidence = null,
    double? scheduleConfidence = null)
{
    /// <summary>
    ///     Server code identifier.
    /// </summary>
    public string ServerCode { get; set; } = serverCode;

    /// <summary>
    ///     Predicted next restart time in UTC, or null when there is insufficient history.
    /// </summary>
    public DateTime? NextProbableRestartTime { get; set; } = nextProbableRestartTime;

    /// <summary>
    ///     The chance in range [0..1] that this is the next restart, including the chance that no unscheduled restart
    ///     occurs first. Null when there is insufficient history.
    /// </summary>
    public double? Confidence { get; set; } = confidence;

    /// <summary>
    ///     The chance in range [0..1] that the scheduled restart slot occurs, without accounting for an earlier
    ///     unscheduled restart. Null when there is insufficient history.
    /// </summary>
    public double? ScheduleConfidence { get; set; } = scheduleConfidence;
}
