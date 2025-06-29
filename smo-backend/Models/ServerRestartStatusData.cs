using SMOBackend.Analytics;

namespace SMOBackend.Models;

/// <summary>
///     Represents data related to server restarts.
/// </summary>
public class ServerRestartStatusData(
    ServerRestartAnalyzerService.ServerRestartData[] restartData,
    bool prevStatus,
    DateTime? lastShutdown)
{
    public ServerRestartAnalyzerService.ServerRestartData[] RestartData { get; set; } = restartData;

    public bool PrevStatus { get; set; } = prevStatus;

    public DateTime? LastShutdown { get; set; } = lastShutdown;
}