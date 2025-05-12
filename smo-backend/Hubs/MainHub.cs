using Microsoft.AspNetCore.SignalR;
using Prometheus;
using SMOBackend.Analytics;
using SMOBackend.Models;
using SMOBackend.Services;

namespace SMOBackend.Hubs;

public class MainHub(
    ILogger<MainHub> logger,
    ServerDataService serverDataService,
    StationDataService stationDataService,
    TrainDataService trainDataService,
    TimeDataService timeDataService,
    TimetableDataService timetableDataService,
    SignalAnalyzerService signalAnalyzerService,
    TrainDelayAnalyzerService trainDelayAnalyzerService,
    RoutePointAnalyzerService routePointAnalyzerService,
    ClientManagerService clientManagerService)
    : Hub
{
    public override async Task OnConnectedAsync()
    {
        clientManagerService.OnClientConnected(Context.ConnectionId);

        if (serverDataService.Data != null)
            await Clients.Caller.SendAsync("ServersReceived", serverDataService.Data);
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        clientManagerService.OnClientDisconnected(Context.ConnectionId);

        return Task.CompletedTask;
    }

    public async Task SwitchServer(string serverCode)
    {
        if (clientManagerService.SelectedServers.TryGetValue(Context.ConnectionId, out var currentServerCode))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, currentServerCode);
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, serverCode);

        clientManagerService.SelectedServers[Context.ConnectionId] = serverCode;

        logger.LogInformation("Client {ConnectionId} switched to server {ServerCode}", Context.ConnectionId,
            serverCode);

        await Clients.Caller.SendAsync("ServerSwitched", serverCode);

        var stations = stationDataService[serverCode];
        if (stations != null)
        {
            await Clients.Caller.SendAsync("StationsReceived", stations);
        }

        var trains = trainDataService[serverCode];
        if (trains != null)
        {
            await Clients.Caller.SendAsync("TrainsReceived", trains);

            var signals = await signalAnalyzerService.GetSignalsForTrains(trains);
            await Clients.Caller.SendAsync("SignalsReceived", signals);

            var delays = trainDelayAnalyzerService.GetDelaysForTrains(trains);
            await Clients.Caller.SendAsync("DelaysReceived", delays);
        }


        var time = timeDataService[serverCode];
        if (time != null)
        {
            await Clients.Caller.SendAsync("TimeReceived", time);
        }


        foreach (var keyValuePair in clientManagerService.SelectedServers)
        {
            // set each server as smo_server_clients{server="serverCode"} = number of clients
            ServerClientsGauge
                .WithLabels(keyValuePair.Value)
                .Set(clientManagerService.SelectedServers.Count(x => x.Value == keyValuePair.Value));
        }
    }

    public async Task<Timetable?> GetTimetable(string trainNoLocal)
    {
        var serverCode = clientManagerService.SelectedServers[Context.ConnectionId];

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                return await timetableDataService.GetTimetableForTrainAsync(serverCode, trainNoLocal);
            }
            catch (Exception ex) when (attempt < 3)
            {
                logger.LogWarning(ex, "Attempt {Attempt} to get timetable for train {TrainNoLocal} failed. Retrying...",
                    attempt, trainNoLocal);
                await Task.Delay(TimeSpan.FromSeconds(10));
            }
        }

        logger.LogError("Failed to get timetable for train {TrainNoLocal} after 3 attempts", trainNoLocal);
        return null;
    }

    /// <summary>
    /// Gets the route points for a given train number.
    /// </summary>
    /// <param name="trainNoLocal">The local train number.</param>
    /// <returns>An array of route points in WKT (Well-Known Text) format.</returns>
    public Task<string[]> GetTrainRoutePoints(string trainNoLocal) => routePointAnalyzerService.GetTrainRoutePoints(trainNoLocal);

    private static readonly Gauge ServerClientsGauge = Metrics
        .CreateGauge("smo_server_clients", "Number of clients connected to each server", "server");
}