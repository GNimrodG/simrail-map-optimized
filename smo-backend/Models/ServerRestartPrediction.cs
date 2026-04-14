namespace SMOBackend.Models;

/// <summary>
///     Represents the next probable restart time for a server.
/// </summary>
public class ServerRestartPrediction(string serverCode, DateTime? nextProbableRestartTime, double? confidence = null)
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
    ///     Confidence score in range [0..1], or null when there is insufficient history.
    /// </summary>
    public double? Confidence { get; set; } = confidence;
}