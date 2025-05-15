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
    TrainPositionDataService trainPositionDataService,
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

    short _stationCounter;

    private async void OnStationDataReceived(Dictionary<string, Station[]> stations)
    {
        try
        {
            if (_stationCounter == 0)
            {
                logger.LogTrace("Sending full station data to clients");
                foreach (var serverData in stations)
                {
                    await hub.Clients.Group(serverData.Key).SendAsync("StationsReceived", serverData.Value);
                }
            }
            else
            {
                logger.LogTrace("Sending partial station data to clients");
                foreach (var serverData in stations)
                {
                    var partialStations = serverData.Value.Select(station => new Station.PartialStation(station))
                        .ToArray();
                    await hub.Clients.Group(serverData.Key).SendAsync("PartialStationsReceived", partialStations);
                }
            }

            // station data is received every 5 seconds, so we can send the full data every minute
            if (++_stationCounter > 12)
                _stationCounter = 0;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending stations to clients");
            _stationCounter = 0;
        }
    }

    short _trainCounter;

    private async void OnTrainDataReceived(PerServerData<Train[]> data)
    {
        try
        {
            try
            {
                trainPositionDataService.ApplyToTrains(data.Data);
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error applying train position data to trains");
            }

            if (_trainCounter == 0)
            {
                logger.LogTrace("Sending full train data to clients for server {ServerCode}", data.ServerCode);

                try
                {
                    await hub.Clients.Group(data.ServerCode).SendAsync("TrainsReceived", data.Data);
                }
                catch (Exception e)
                {
                    logger.LogError(e, "Error sending trains to clients");
                    _trainCounter = -1; // it will be incremented to 0 at the end of the method
                }

                try
                {
                    await hub.Clients.Group(data.ServerCode).SendAsync("SignalsReceived",
                        await signalAnalyzerService.GetSignalsForTrains(data.Data));
                }
                catch (Exception e)
                {
                    logger.LogError(e, "Error sending signals to clients");
                    _trainCounter = -1; // it will be incremented to 0 at the end of the method
                }
            }
            else
            {
                logger.LogTrace("Sending partial train data to clients for server {ServerCode}", data.ServerCode);

                try
                {
                    var partialTrains = data.Data.Select(train => new Train.PartialTrainData(train)).ToArray();
                    await hub.Clients.Group(data.ServerCode).SendAsync("PartialTrainsReceived", partialTrains);
                }
                catch (Exception e)
                {
                    logger.LogError(e, "Error sending partial trains to clients");
                    _trainCounter = -1; // it will be incremented to 0 at the end of the method
                }

                try
                {
                    var partialSignals = (await signalAnalyzerService.GetSignalsForTrains(data.Data))
                        .Select(signal => new SignalStatus.PartialSignalStatus(signal)).ToArray();
                    await hub.Clients.Group(data.ServerCode).SendAsync("PartialSignalsReceived", partialSignals);
                }
                catch (Exception e)
                {
                    logger.LogError(e, "Error sending partial signals to clients");
                    _trainCounter = -1; // it will be incremented to 0 at the end of the method
                }
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

            // train data is received every 5 seconds, so we can send the full data every 5 minutes
            if (++_trainCounter > 60)
                _trainCounter = 0;
        }
        catch (Exception e)
        {
            logger.LogCritical(e, "Error sending trains to clients");
            _trainCounter = 0;
        }
    }

    private void OnTrainPositionDataReceived(PerServerData<TrainPosition[]> data)
    {
        try
        {
            logger.LogTrace("Sending train positions to clients for server {ServerCode}", data.ServerCode);
            hub.Clients.Group(data.ServerCode).SendAsync("TrainPositionsReceived", data.Data);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending train positions to clients");
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

        trainPositionDataService.PerServerDataReceived += OnTrainPositionDataReceived;

        timeDataService.DataReceived += OnTimeDataReceived;

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Stopping ClientDataSenderService");

        serverDataService.DataReceived -= OnServerDataReceived;

        stationDataService.DataReceived -= OnStationDataReceived;

        trainDataService.PerServerDataReceived -= OnTrainDataReceived;

        trainPositionDataService.PerServerDataReceived -= OnTrainPositionDataReceived;

        timeDataService.DataReceived -= OnTimeDataReceived;

        return Task.CompletedTask;
    }
}