using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models;
using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
/// Service to fetch and store server data.
/// </summary>
public class ServerDataService(
    ILogger<ServerDataService> logger,
    IServiceProvider serviceProvider,
    IServiceScopeFactory scopeFactory,
    SimrailApiClient apiClient
)
    : BaseTimeAlignedDataService<ServerStatus[]>("SERVER", logger, scopeFactory)
{
    private static readonly Gauge ServerStatusGauge = Metrics
        .CreateGauge("smo_server_status", "Status of the server", "server", "region", "name");

    private readonly List<IServerMetricsCleaner> _metricCleaners = [];

    // Keep track of previously active servers to detect which ones went offline
    private readonly HashSet<string> _previouslyActiveServers = [];

    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;

    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(30);

    /// <inheritdoc />
    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        // Manually discover and resolve metric cleaners to avoid circular dependencies
        DiscoverMetricCleaners();

        logger.LogInformation("Found {CleanerCount} metric cleaners", _metricCleaners.Count);

        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SmoContext>();

        logger.LogInformation("Checking database...");

        // Ensure the database is created and apply any pending migrations
        await dbContext.Database.MigrateAsync(cancellationToken);

        logger.LogInformation("Database is ready");

        await base.StartAsync(cancellationToken);
    }

    private void DiscoverMetricCleaners()
    {
        // Find all types that implement IServerMetricsCleaner
        var cleanerTypes = Assembly.GetExecutingAssembly()
            .GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IServerMetricsCleaner).IsAssignableFrom(t))
            .ToList();

        foreach (var cleanerType in cleanerTypes)
        {
            try
            {
                // Try to get the service from DI container
                var service = serviceProvider.GetService(cleanerType);

                if (service is not IServerMetricsCleaner cleaner) continue;

                _metricCleaners.Add(cleaner);
                logger.LogDebug("Registered metric cleaner: {CleanerType}", cleanerType.Name);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to resolve metric cleaner: {CleanerType}", cleanerType.Name);
            }
        }
    }

    private protected override Task<ApiResponseWithAge<ServerStatus[]>> FetchData(CancellationToken stoppingToken)
    {
        return apiClient.GetServersWithAgeAsync(stoppingToken);
    }

    /// <inheritdoc />
    protected override void OnDataReceived(ApiResponseWithAge<ServerStatus[]> data)
    {
        base.OnDataReceived(data);

        ServerStatusGauge.Clear();

        // Get current active server codes
        var currentActiveServers = new HashSet<string>();

        foreach (var server in data.Data)
        {
            ServerStatusGauge.WithLabels(server.ServerCode, server.ServerRegion, server.ServerName)
                .Set(server.IsActive ? 1 : 0);

            if (server.IsActive) currentActiveServers.Add(server.ServerCode);
        }

        // Find servers that went offline or disappeared
        var offlineServers = _previouslyActiveServers.Except(currentActiveServers).ToList();

        // Clear metrics for offline/disappeared servers
        foreach (var offlineServerCode in offlineServers)
        {
            logger.LogInformation("Server {ServerCode} went offline, clearing associated metrics", offlineServerCode);

            // Notify all metric cleaners to clear their server-specific metrics
            foreach (var cleaner in _metricCleaners)
            {
                try
                {
                    cleaner.ClearServerMetrics(offlineServerCode);
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Failed to clear metrics for server {ServerCode} in cleaner {CleanerType}",
                        offlineServerCode, cleaner.GetType().Name);
                }
            }
        }

        // Update the set of previously active servers
        _previouslyActiveServers.Clear();
        _previouslyActiveServers.UnionWith(currentActiveServers);
    }
}