using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models;

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
    /// <inheritdoc cref="BaseServerDataService{TimeData}.FetchInterval"/>
    protected override TimeSpan FetchInterval => TimeSpan.FromMinutes(5);

    // The TIME API is rate limited to 10 requests/second/IP address.
    // Just to be safe, we'll limit it to ~4 requests/second.
    private protected override TimeSpan DelayBetweenServers => TimeSpan.FromMilliseconds(250);

    protected override async Task<TimeData> FetchServerData(string serverCode, CancellationToken stoppingToken)
    {
        var timezone = await apiClient.GetTimezoneAsync(serverCode, stoppingToken);

        if (timezone == null)
        {
            throw new("Failed to fetch timezone data");
        }

        var time = await apiClient.GetTimeAsync(serverCode, stoppingToken);

        if (time == null)
        {
            throw new("Failed to fetch time data");
        }

        return new(time.Value.time, timezone.Value, time.Value.date);
    }

    protected override void OnPerServerDataReceived(PerServerData<TimeData> data)
    {
        base.OnPerServerDataReceived(data);

        ServerTimezoneGauge.WithLabels(data.ServerCode).Set(data.Data.Timezone);
    }

    private static readonly Gauge ServerTimezoneGauge = Metrics.CreateGauge(
        "smo_server_timezone",
        "The timezone of the server",
        "server");
}