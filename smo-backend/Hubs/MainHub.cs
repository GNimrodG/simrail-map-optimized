using Microsoft.AspNetCore.SignalR;
using Prometheus;
using SMOBackend.Analytics;
using SMOBackend.Models;
using SMOBackend.Models.Steam;
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
    ServerRestartAnalyzerService serverRestartAnalyzerService,
    ClientManagerService clientManagerService,
    SteamApiClient steamApiClient)
    : Hub
{
    private static readonly Gauge ServerClientsGauge = Metrics
        .CreateGauge("smo_server_clients", "Number of clients connected to each server", "server");

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

        lock (clientManagerService.SelectedServers)
        {
            clientManagerService.SelectedServers[Context.ConnectionId] = serverCode;
        }

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
        if (time != null) await Clients.Caller.SendAsync("TimeReceived", time);

        lock (clientManagerService.SelectedServers)
        {
            // Remove the old values
            foreach (var labelValue in ServerClientsGauge.GetAllLabelValues())
                if (clientManagerService.SelectedServers.Values.All(x => x != labelValue[0]))
                    ServerClientsGauge.RemoveLabelled(labelValue);

            foreach (var server in clientManagerService.SelectedServers.Values.Distinct())
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
    public async Task GetStations()
    {
        try
        {
            if (!clientManagerService.SelectedServers.TryGetValue(Context.ConnectionId, out var serverCode))
            {
                logger.LogWarning("Client {ConnectionId} tried to get stations without a selected server",
                    Context.ConnectionId);
                return;
            }

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
    public async Task GetTrains()
    {
        try
        {
            if (!clientManagerService.SelectedServers.TryGetValue(Context.ConnectionId, out var serverCode))
            {
                logger.LogWarning("Client {ConnectionId} tried to get trains without a selected server",
                    Context.ConnectionId);
                return;
            }

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
    public async Task GetSignals()
    {
        try
        {
            if (!clientManagerService.SelectedServers.TryGetValue(Context.ConnectionId, out var serverCode))
            {
                logger.LogWarning("Client {ConnectionId} tried to get signals without a selected server",
                    Context.ConnectionId);
                return;
            }

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

    /// <summary>
    ///     Gets the steam profile data for a given Steam ID.
    /// </summary>
    /// <param name="steamId">The Steam ID to fetch profile data for.</param>
    public async Task<PlayerSummary?> GetSteamProfileData(string steamId)
    {
        try
        {
            if (!steamApiClient.IsAvailable)
            {
                logger.LogWarning("Steam API client is not configured, cannot fetch profile data");
                await Clients.Caller.SendAsync("SteamProfileDataUnavailable");
                return null;
            }

            try
            {
                var profileData = await steamApiClient.GetPlayerSummaries(steamId);

                if (profileData != null && profileData.Response.Players.Length != 0)
                    return profileData.Response.Players[0];

                logger.LogWarning("No profile data found for Steam ID {SteamId}", steamId);
                return null;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error fetching Steam profile data for {SteamId}", steamId);
                await Clients.Caller.SendAsync("SteamProfileDataError", new { steamId, error = e.Message });
                return null;
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending Steam profile data to client");
            await Clients.Caller.SendAsync("SteamProfileDataError", new { steamId, error = e.Message });
            return null;
        }
    }

    /// <summary>
    ///     Gets the Steam stats for a given Steam ID.
    /// </summary>
    /// <param name="steamId">The Steam ID to fetch stats for.</param>
    public async Task<PlayerStats?> GetSteamStats(string steamId)
    {
        try
        {
            if (!steamApiClient.IsAvailable)
            {
                logger.LogWarning("Steam API client is not configured, cannot fetch stats");
                await Clients.Caller.SendAsync("SteamProfileDataUnavailable");
                return null;
            }

            try
            {
                var statsData = await steamApiClient.GetPlayerStats(steamId);
                if (statsData != null && statsData.PlayerStats.Stats.Count != 0) return statsData.PlayerStats;

                logger.LogWarning("No stats found for Steam ID {SteamId}", steamId);
                return null;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error fetching Steam stats for {SteamId}", steamId);
                await Clients.Caller.SendAsync("SteamStatsError", new { steamId, error = e.Message });
                return null;
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error sending Steam stats to client");
            await Clients.Caller.SendAsync("SteamStatsError", new { steamId, error = e.Message });
            return null;
        }
    }

    /// <summary>
    ///     Gets the next server restart prediction for the currently selected server.
    /// </summary>
    public DateTime? GetNextServerRestart()
    {
        try
        {
            var serverCode = clientManagerService.SelectedServers[Context.ConnectionId];
            var nextRestart = serverRestartAnalyzerService.PredictNextRestart(serverCode);
            if (nextRestart != null) return nextRestart;
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error getting next server restart");
        }

        return null;
    }

    /// <summary>
    ///     Gets the possible path lines in WKT for a given signal.
    /// </summary>
    /// <param name="signal">The signal for which to get the lines.</param>
    /// <returns>An array of WKT (Well-Known Text) representations of the lines.</returns>
    public async Task<string[]> GetLinesForSignal(string signal)
    {
        try
        {
            return await routePointAnalyzerService.GetLinesForSignal(signal);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error getting lines for signal {Signal}", signal);
            await Clients.Caller.SendAsync("SignalLinesError", new { signal, error = e.Message });
            return [];
        }
    }

    /// <summary>
    ///     Gets the possible path lines in WKT for a connection between two signals.
    /// </summary>
    /// <param name="prevSignal">The previous signal in the connection.</param>
    /// <param name="nextSignal">The next signal in the connection.</param>
    /// <returns>An array of WKT (Well-Known Text) representations of the lines for the connection.</returns>
    public async Task<string[]> GetLinesForSignalConnection(string prevSignal, string nextSignal)
    {
        try
        {
            return await routePointAnalyzerService.GetLinesForSignalConnection(prevSignal, nextSignal);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error getting lines for signal connection {PrevSignal} -> {NextSignal}", prevSignal,
                nextSignal);
            await Clients.Caller.SendAsync("SignalConnectionLinesError",
                new { prevSignal, nextSignal, error = e.Message });
            return [];
        }
    }
}