using Prometheus;

namespace SMOBackend.Services;

public class ClientManagerService(ILogger<ClientManagerService> logger)
{
    private static readonly Gauge ClientCountGauge = Metrics
        .CreateGauge("smo_connected_clients", "Number of connected clients");

    private readonly Lock _lock = new();

    public int ConnectionCount { get; private set; }

    public Dictionary<string, string> SelectedServers { get; } = new();

    public void OnClientConnected(string connectionId)
    {
        lock (_lock)
        {
            ConnectionCount++;
            ClientCountGauge.Set(ConnectionCount);
        }

        logger.LogInformation("Client connected with id {ConnectionId}, total connections: {ConnectionCount}",
            connectionId, ConnectionCount);
    }

    public void OnClientDisconnected(string connectionId)
    {
        lock (_lock)
        {
            ConnectionCount--;
            ClientCountGauge.Set(ConnectionCount);
        }

        logger.LogInformation("Client disconnected with id {ConnectionId}, total connections: {ConnectionCount}",
            connectionId, ConnectionCount);
    }
}