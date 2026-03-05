using Prometheus;
using SMOBackend.Models;
using SMOBackend.Services.ApiClients;
using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
/// Service for fetching time data from the Simrail API.
/// </summary>
public class TimeDataService(
    ILogger<TimeDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient)
    : BaseServerDataService<TimeData>("TIME", logger, scopeFactory, serverDataService)
{
    private static readonly Gauge ServerTimezoneGauge = Metrics.CreateGauge(
        "smo_server_timezone",
        "The timezone of the server",
        "server");

    /// <inheritdoc cref="BaseServerDataService{TimeData}.FetchInterval"/>
    protected override TimeSpan FetchInterval => TimeSpan.FromMinutes(5);

    // The TIME API is rate limited to 10 requests/second/IP address.
    // Just to be safe, we'll limit it to ~4 requests/second.
    private protected override TimeSpan DelayBetweenServers => TimeSpan.FromMilliseconds(250);

    /// <inheritdoc />
    protected override async Task<TimeData> FetchServerData(string serverCode, CancellationToken stoppingToken)
    {
        var timezone = await apiClient.GetTimezoneAsync(serverCode, stoppingToken).NoContext();
        var time = await apiClient.GetTimeAsync(serverCode, stoppingToken).NoContext();

        return new(time.time, timezone, time.date);
    }

    /// <inheritdoc />
    protected override void OnPerServerDataReceived(PerServerData<TimeData> data)
    {
        base.OnPerServerDataReceived(data);

        ServerTimezoneGauge.WithLabels(data.ServerCode).Set(data.Data.Timezone);
    }
}