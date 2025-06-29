namespace SMOBackend.Services;

/// <summary>
/// Interface for services that need to clear server-specific metrics when a server goes offline.
/// </summary>
public interface IServerMetricsCleaner
{
    /// <summary>
    /// Clears all metrics associated with the specified server.
    /// </summary>
    /// <param name="serverCode">The server code for which to clear metrics</param>
    void ClearServerMetrics(string serverCode);
}
