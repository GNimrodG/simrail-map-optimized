using Prometheus;
using SMOBackend.Models;
using SMOBackend.Services.ApiClients;

namespace SMOBackend.Services;

public class StationDataService(
    ILogger<StationDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient) : BaseServerDataService<Station[]>("STATION", logger, scopeFactory, serverDataService)
{
    protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(5);

    protected override Task<Station[]> FetchServerData(string serverCode, CancellationToken stoppingToken) =>
        apiClient.GetStationsAsync(serverCode, stoppingToken);

    protected override void OnPerServerDataReceived(PerServerData<Station[]> data)
    {
        base.OnPerServerDataReceived(data);

        StationCountGauge.WithLabels(data.ServerCode).Set(data.Data.Length);
        PlayerStationCountGauge.WithLabels(data.ServerCode)
            .Set(data.Data.Count(station => station.DispatchedBy.Length > 0));
    }

    private static readonly Gauge StationCountGauge = Metrics
        .CreateGauge("smo_station_count", "Number of stations on the server", "server");

    private static readonly Gauge PlayerStationCountGauge = Metrics
        .CreateGauge("smo_player_station_count", "Number of stations on the server that are controlled by a player",
            "server");
}