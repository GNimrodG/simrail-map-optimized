namespace SMOBackend.Models;

/// <summary>
/// Represents the status response from the server.
/// </summary>
public class StatusResponse(int connectedClients, Dictionary<string, int>? serverClientUsage, ServerStatus[]? servers)
{
    /// <summary>
    /// The number of connected clients.
    /// </summary>
    public int ConnectedClients { get; set; } = connectedClients;

    /// <summary>
    /// The number of connected clients per server.
    /// </summary>
    public Dictionary<string, int> ServerClientUsageByServer { get; set; } = serverClientUsage ?? new();

    /// <summary>
    /// The server statuses.
    /// </summary>
    public ServerStatus[] Servers { get; set; } = servers ?? [];
}