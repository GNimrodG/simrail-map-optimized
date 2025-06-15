using Microsoft.EntityFrameworkCore;
using Prometheus;
using SMOBackend.Analytics;
using SMOBackend.Data;
using SMOBackend.Models;
using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
/// Service to fetch and store server data.
/// </summary>
public class ServerDataService(
    ILogger<ServerDataService> logger,
    IServiceScopeFactory scopeFactory,
    SimrailApiClient apiClient)
    : BaseDataService<ServerStatus[]>("SERVER", logger, scopeFactory)
{
    private static readonly Gauge ServerStatusGauge = Metrics
        .CreateGauge("smo_server_status", "Status of the server", "server", "region", "name");

    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(30);

    /// <inheritdoc />
    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SmoContext>();

        logger.LogInformation("Checking database...");

        // Ensure the database is created and apply any pending migrations
        await dbContext.Database.MigrateAsync(cancellationToken);

        logger.LogInformation("Database is ready");

        await base.StartAsync(cancellationToken);
    }

    private protected override Task<ServerStatus[]> FetchData(CancellationToken stoppingToken) =>
        apiClient.GetServersAsync(stoppingToken);

    protected override void OnDataReceived(ServerStatus[] data)
    {
        base.OnDataReceived(data);

        ServerStatusGauge.Clear();

        foreach (var server in data)
        {
            ServerStatusGauge.WithLabels(server.ServerCode, server.ServerRegion, server.ServerName)
                .Set(server.IsActive ? 1 : 0);
        }

        foreach (var labels in SignalAnalyzerService.SignalsWithMultipleTrainsPerServer.GetAllLabelValues())
        {
            if (data.All(server => server.ServerCode != labels[0]))
                SignalAnalyzerService.SignalsWithMultipleTrainsPerServer.RemoveLabelled(labels);
        }

        foreach (var labels in SignalAnalyzerService.SignalsWithMultipleTrains.GetAllLabelValues())
        {
            if (data.All(server => server.ServerCode != labels[0]))
                SignalAnalyzerService.SignalsWithMultipleTrains.RemoveLabelled(labels);
        }
    }
}