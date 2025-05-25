using Microsoft.AspNetCore.SignalR;
using Prometheus;
using SMOBackend.Analytics;
using SMOBackend.Models;
using SMOBackend.Services;

namespace SMOBackend.Hubs;

/// <summary>
/// MainHub is the SignalR hub for real-time communication with clients.
/// </summary>
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
    /// <inheritdoc />
    public override async Task OnConnectedAsync()
    {
        clientManagerService.OnClientConnected(Context.ConnectionId);

        if (serverDataService.Data != null)
            await Clients.Caller.SendAsync("ServersReceived", serverDataService.Data);
    }

    /// <inheritdoc />
    public override Task OnDisconnectedAsync(Exception? exception)
    {
        clientManagerService.OnClientDisconnected(Context.ConnectionId);

        if (clientManagerService.SelectedServers.Remove(Context.ConnectionId, out var serverCode))
        {
            ServerClientsGauge.WithLabels(serverCode)
                .Set(clientManagerService.SelectedServers.Count(x => x.Value == serverCode));
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Switches the server for the client.
    /// </summary>
    /// <param name="serverCode">The server code to switch to.</param>
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


        // Remove the old values
        foreach (var labelValue in ServerClientsGauge.GetAllLabelValues())
        {
            if (clientManagerService.SelectedServers.Values.All(x => x != labelValue[0]))
                ServerClientsGauge.RemoveLabelled(labelValue);
        }

        foreach (var server in clientManagerService.SelectedServers.Values.Distinct())
        {
            ServerClientsGauge
                .WithLabels(server)
                .Set(clientManagerService.SelectedServers.Count(x => x.Value == server));
        }
    }

    /// <summary>
    /// Gets the timetable for a given train number.
    /// </summary>
    /// <param name="trainNoLocal">The local train number.</param>
    /// <returns>The timetable for the train, or null if not found.</returns>
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
    public Task<string[]> GetTrainRoutePoints(string trainNoLocal) =>
        routePointAnalyzerService.GetTrainRoutePoints(trainNoLocal);

    /// <summary>
    /// Gets the stations for the currently selected server.
    /// </summary>
    public async void GetStations()
    {
        try
        {
            var serverCode = clientManagerService.SelectedServers[Context.ConnectionId];

            var stations = stationDataService[serverCode];
            if (stations != null)
            {
                await Clients.Caller.SendAsync("StationsReceived", stations);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending stations to client");
        }
    }
    
    /// <summary>
    /// Gets the trains for the currently selected server.
    /// </summary>
    public async void GetTrains() 
    {
        try
        {
            var serverCode = clientManagerService.SelectedServers[Context.ConnectionId];

            var trains = trainDataService[serverCode];
            if (trains != null)
            {
                await Clients.Caller.SendAsync("TrainsReceived", trains);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending trains to client");
        }
    }
    
    /// <summary>
    /// Gets the signals for the currently selected server.
    /// </summary>
    public async void GetSignals() 
    {
        try
        {
            var serverCode = clientManagerService.SelectedServers[Context.ConnectionId];

            var trains = trainDataService[serverCode];
            if (trains == null) return;
            
            var signals = await signalAnalyzerService.GetSignalsForTrains(trains);
            await Clients.Caller.SendAsync("SignalsReceived", signals);
        }
        catch (ObjectDisposedException) // Ignore if the client disconnected
        {
            logger.LogWarning("Client disconnected while getting signals");
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending signals to client");
        }
    }

    private static readonly Gauge ServerClientsGauge = Metrics
        .CreateGauge("smo_server_clients", "Number of clients connected to each server", "server");
}