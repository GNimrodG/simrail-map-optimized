using SMOBackend.Models;
using SMOBackend.Services;
using SMOBackend.Utils;

namespace SMOBackend.Analytics;

/// <summary>
///     Service that analyzes server restart patterns and tracks server shutdown/restart times.
///     This service monitors server status changes to detect when servers go offline and come back online,
///     maintaining historical data about restart frequencies and patterns.
/// </summary>
public class ServerRestartAnalyzerService(ILogger<ServerDataService> logger, ServerDataService serverDataService)
    : IHostedService
{
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "server-restarts");
    private static readonly string ServerRestartsFile = Path.Combine(DataDirectory, "server-restarts.bin");

    private static readonly string PreviousServerStatusFile =
        Path.Combine(DataDirectory, "previous-server-status.bin");

    private static readonly string LastShutdownTimeFile = Path.Combine(DataDirectory, "last-shutdown-time.bin");
    private readonly TtlCache<string, DateTime> _lastShutdownTime = new(TimeSpan.FromMinutes(5), "LastShutdownTime");

    private readonly TtlCache<string, bool> _prevServerStatus = new(TimeSpan.FromMinutes(5), "PreviousServerStatus");

    private readonly TtlCache<string, ServerRestartData[]> _serverRestartTimes =
        new(TimeSpan.FromDays(1), "ServerRestartTimes");

    /// <summary>
    ///     Starts the server restart analyzer service.
    ///     Creates necessary directories, loads existing data from files, and sets up periodic data saving.
    /// </summary>
    /// <param name="cancellationToken">Token to monitor for cancellation requests.</param>
    /// <returns>A task that represents the asynchronous start operation.</returns>
    public Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Starting server restarts data service...");
        Directory.CreateDirectory(DataDirectory);

        TryLoadFromFile(ServerRestartsFile, _serverRestartTimes);
        TryLoadFromFile(PreviousServerStatusFile, _prevServerStatus);
        TryLoadFromFile(LastShutdownTimeFile, _lastShutdownTime);

        // Save the last timetable index and train delays to file every 5 minutes in the background
        var thread = new Thread(async void () =>
        {
            try
            {
                using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
                while (!cancellationToken.IsCancellationRequested)
                {
                    await timer.WaitForNextTickAsync(cancellationToken);
                    await _serverRestartTimes.SaveToFileAsync(ServerRestartsFile);
                    logger.LogInformation("Saved server restarts to file {ServerRestartsFile}", ServerRestartsFile);
                }
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error saving server restarts to file {ServerRestartsFile}",
                    ServerRestartsFile);
                File.Delete(ServerRestartsFile);
            }
        });

        thread.Start();

        serverDataService.DataReceived += OnServerDataReceived;

        logger.LogInformation("Server restarts data service started successfully");
        return Task.CompletedTask;
    }

    /// <summary>
    ///     Stops the server restart analyzer service.
    ///     Unsubscribes from events and saves current data to files.
    /// </summary>
    /// <param name="cancellationToken">Token to monitor for cancellation requests.</param>
    /// <returns>A task that represents the asynchronous stop operation.</returns>
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Stopping server restarts data service...");

        try
        {
            serverDataService.DataReceived -= OnServerDataReceived;
            await _serverRestartTimes.SaveToFileAsync(ServerRestartsFile);
            logger.LogInformation("Server restarts data service stopped successfully");
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error stopping server restarts data service");
        }
    }

    /// <summary>
    ///     Attempts to load data from a file into the specified cache.
    ///     If the file doesn't exist or loading fails, the operation is skipped without throwing an exception.
    /// </summary>
    /// <typeparam name="T">The type of data to load.</typeparam>
    /// <param name="filePath">The path to the file to load from.</param>
    /// <param name="cache">The cache to load the data into.</param>
    private void TryLoadFromFile<T>(string filePath, TtlCache<string, T> cache)
    {
        if (!File.Exists(filePath)) return;

        try
        {
            cache.LoadFromFile(filePath);
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Failed to load data from file {FilePath}", filePath);
        }
    }

    /// <summary>
    ///     Handles server data updates to detect server status changes.
    ///     Monitors servers going offline (shutdown) and coming online (restart).
    /// </summary>
    /// <param name="data">Array of current server status data.</param>
    private void OnServerDataReceived(ServerStatus[] data)
    {
        foreach (var serverStatus in data)
            if (_prevServerStatus.TryGetValue(serverStatus.ServerCode, out var prevStatus))
            {
                switch (prevStatus)
                {
                    case true when !serverStatus.IsActive &&
                                   !_lastShutdownTime.TryGetValue(serverStatus.ServerCode, out _):
                        // Server was online and is now offline, record the shutdown time
                        _lastShutdownTime[serverStatus.ServerCode] = DateTime.UtcNow;
                        break;
                    case false when serverStatus.IsActive:
                    {
                        // Server was offline and is now online, record the restart time
                        var restartTime = DateTime.UtcNow;
                        if (_lastShutdownTime.TryGetValue(serverStatus.ServerCode, out var lastShutdown))
                        {
                            var restartData = new ServerRestartData(lastShutdown, restartTime);
                            if (_serverRestartTimes.TryGetValue(serverStatus.ServerCode, out var restarts))
                            {
                                restarts = restarts.Append(restartData).ToArray();
                                _serverRestartTimes[serverStatus.ServerCode] = restarts;
                            }
                            else
                            {
                                _serverRestartTimes[serverStatus.ServerCode] = [restartData];
                            }

                            logger.LogInformation(
                                "Server {ServerCode} restarted at {RestartTime} after shutdown at {ShutdownTime:o}",
                                serverStatus.ServerCode, restartTime, lastShutdown);
                        }

                        break;
                    }
                }
            }
            else
            {
                // First time seeing this server, just record its status
                _prevServerStatus[serverStatus.ServerCode] = serverStatus.IsActive;

                if (serverStatus.IsActive)
                    // If the server is active, we don't have a shutdown time yet
                    _lastShutdownTime.Remove(serverStatus.ServerCode);
                else
                    // If the server is not active, record the current time as the last shutdown time
                    _lastShutdownTime[serverStatus.ServerCode] = DateTime.UtcNow;
            }
    }

    /// <summary>
    ///     Gets the historical restart data for a specific server.
    /// </summary>
    /// <param name="serverName">The name of the server to get restart data for.</param>
    /// <returns>An array of <see cref="ServerRestartData" /> containing all recorded restarts for the server.</returns>
    public ServerRestartData[] GetServerRestarts(string serverName) =>
        _serverRestartTimes.TryGetValue(serverName, out var restarts) ? restarts : [];

    /// <summary>
    ///     Predicts the next restart time for a server based on historical restart patterns.
    ///     Uses the average duration between restarts to estimate when the next restart might occur.
    /// </summary>
    /// <param name="serverName">The name of the server to predict restart time for.</param>
    /// <returns>The predicted next restart time, or null if there's insufficient data (less than 2 restarts).</returns>
    public DateTime? PredictNextRestart(string serverName)
    {
        // get the last restart times and calculate the average duration between restarts
        if (!_serverRestartTimes.TryGetValue(serverName, out var restarts) ||
            restarts.Length < 2) return null; // Not enough data to predict

        var durations = new List<TimeSpan>();
        for (var i = 1; i < restarts.Length; i++) durations.Add(restarts[i].RestartTime - restarts[i - 1].RestartTime);

        var averageDuration = TimeSpan.FromTicks((long)durations.Average(d => d.Ticks));

        // Predict the next restart time based on the last restart time and the average duration
        var lastRestart = restarts[^1].RestartTime;
        return lastRestart + averageDuration;
    }

    /// <summary>
    ///     Gets comprehensive restart status data for a specific server.
    /// </summary>
    /// <param name="serverName">The name of the server to get data for.</param>
    /// <returns>
    ///     A <see cref="ServerRestartStatusData" /> object containing restart history, current status, and last shutdown
    ///     time.
    /// </returns>
    public ServerRestartStatusData GetRestartData(string serverName)
    {
        var restarts = GetServerRestarts(serverName);
        var prevStatus = _prevServerStatus.TryGetValue(serverName, out var status) && status;
        DateTime? lastShutdown = _lastShutdownTime.TryGetValue(serverName, out var shutdownTime) ? shutdownTime : null;

        return new(restarts, prevStatus, lastShutdown);
    }

    /// <summary>
    ///     Represents data about a server restart, including the shutdown time and restart time.
    /// </summary>
    public readonly struct ServerRestartData
    {
        /// <summary>
        ///     Gets the time when the server was shut down, or null if it was never shut down.
        /// </summary>
        public DateTime? ShutdownTime { get; }

        /// <summary>
        ///     Gets the time when the server was restarted.
        /// </summary>
        public DateTime RestartTime { get; }

        /// <summary>
        ///     Initializes a new instance of the <see cref="ServerRestartData" /> struct.
        /// </summary>
        /// <param name="shutdownTime">The time when the server was shut down.</param>
        /// <param name="restartTime">The time when the server was restarted.</param>
        public ServerRestartData(DateTime? shutdownTime, DateTime restartTime)
        {
            ShutdownTime = shutdownTime;
            RestartTime = restartTime;
        }

        /// <summary>
        ///     Calculates the duration between shutdown and restart.
        /// </summary>
        /// <returns>The time span between shutdown and restart, or <see cref="TimeSpan.Zero" /> if no shutdown time is available.</returns>
        public TimeSpan GetDuration()
        {
            return ShutdownTime.HasValue ? RestartTime - ShutdownTime.Value : TimeSpan.Zero;
        }

        /// <summary>
        ///     Returns a string representation of the restart data.
        /// </summary>
        /// <returns>A formatted string showing shutdown time, restart time, and duration.</returns>
        public override string ToString() =>
            $"{ShutdownTime?.ToString("o") ?? "N/A"} - {RestartTime:o} ({GetDuration()})";
    }
}