using Microsoft.AspNetCore.SignalR;
using SMOBackend.Analytics;
using SMOBackend.Hubs;
using SMOBackend.Models;
using SMOBackend.Models.Trains;

namespace SMOBackend.Services;

internal class ClientDataSenderService(
    ILogger<ClientDataSenderService> logger,
    IHubContext<MainHub> hub,
    ServerDataService serverDataService,
    StationDataService stationDataService,
    TrainDataService trainDataService,
    TimeDataService timeDataService,
    SignalAnalyzerService signalAnalyzerService,
    TrainDelayAnalyzerService trainDelayAnalyzerService
) : IHostedService
{
    private async void OnServerDataReceived(IEnumerable<ServerStatus> servers)
    {
        try
        {
            logger.LogTrace("Sending servers to clients");
            await hub.Clients.All.SendAsync("ServersReceived", servers);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending servers to clients");
        }
    }

    private async void OnStationDataReceived(Dictionary<string, Station[]> stations)
    {
        try
        {
            logger.LogTrace("Sending stations to clients");
            foreach (var serverData in stations)
            {
                await hub.Clients.Group(serverData.Key).SendAsync("StationsReceived", serverData.Value);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending stations to clients");
        }
    }

    private async void OnTrainDataReceived(PerServerData<Train[]> data)
    {
        try
        {
            logger.LogTrace("Sending trains to clients for server {ServerCode}", data.ServerCode);

            try
            {
                await hub.Clients.Group(data.ServerCode).SendAsync("TrainsReceived", data.Data);
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error sending trains to clients");
            }

            try
            {
                await hub.Clients.Group(data.ServerCode).SendAsync("SignalsReceived",
                    await signalAnalyzerService.GetSignalsForTrains(data.Data));
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error sending signals to clients");
            }

            try
            {
                await hub.Clients.Group(data.ServerCode).SendAsync("DelaysReceived",
                    trainDelayAnalyzerService.GetDelaysForTrains(data.Data));
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error sending delays to clients");
            }
        }
        catch (Exception e)
        {
            logger.LogCritical(e, "Error sending trains to clients");
        }
    }

    private async void OnTimeDataReceived(Dictionary<string, TimeData> timeData)
    {
        try
        {
            logger.LogTrace("Sending time to clients");
            foreach (var serverData in timeData)
            {
                await hub.Clients.Group(serverData.Key).SendAsync("TimeReceived", serverData.Value);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending time to clients");
        }
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Starting ClientDataSenderService");

        serverDataService.DataReceived += OnServerDataReceived;

        stationDataService.DataReceived += OnStationDataReceived;

        trainDataService.PerServerDataReceived += OnTrainDataReceived;

        timeDataService.DataReceived += OnTimeDataReceived;

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Stopping ClientDataSenderService");

        serverDataService.DataReceived -= OnServerDataReceived;

        stationDataService.DataReceived -= OnStationDataReceived;

        trainDataService.PerServerDataReceived -= OnTrainDataReceived;

        timeDataService.DataReceived -= OnTimeDataReceived;

        return Task.CompletedTask;
    }
}