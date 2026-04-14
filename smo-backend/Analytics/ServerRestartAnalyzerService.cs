using SMOBackend.Models;
using SMOBackend.Services;
using SMOBackend.Utils;

namespace SMOBackend.Analytics;

/// <summary>
///     Service that analyzes server restart patterns and tracks server shutdown/restart times.
///     This service monitors server status changes to detect when servers go offline and come back online,
///     maintaining historical data about restart frequencies and patterns.
/// </summary>
public class ServerRestartAnalyzerService(
    ILogger<ServerRestartAnalyzerService> logger,
    ServerDataService serverDataService)
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

    private Task? _persistenceTask;

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

        _persistenceTask = Task.Run(async () => await RunPersistenceLoopAsync(cancellationToken),
            CancellationToken.None);

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

            await SaveAllCachesAsync();

            if (_persistenceTask != null)
                try
                {
                    await _persistenceTask.WaitAsync(cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    // Host is shutting down, no extra action needed.
                }

            logger.LogInformation("Server restarts data service stopped successfully");
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error stopping server restarts data service");
        }
    }

    private async Task RunPersistenceLoopAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
            while (await timer.WaitForNextTickAsync(cancellationToken)) await SaveAllCachesAsync();
        }
        catch (OperationCanceledException)
        {
            logger.LogDebug("Server restarts persistence loop cancelled");
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error in server restarts persistence loop");
        }
    }

    private async Task SaveAllCachesAsync()
    {
        await _serverRestartTimes.SaveToFileAsync(ServerRestartsFile);
        await _prevServerStatus.SaveToFileAsync(PreviousServerStatusFile);
        await _lastShutdownTime.SaveToFileAsync(LastShutdownTimeFile);
        logger.LogInformation("Saved server restart analyzer data to disk");
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
        {
            if (_prevServerStatus.TryGetValue(serverStatus.ServerCode, out var prevStatus))
            {
                switch (prevStatus)
                {
                    case true when !serverStatus.IsActive &&
                                   !_lastShutdownTime.TryGetValue(serverStatus.ServerCode, out _):
                        // Server was online and is now offline, record the shutdown time.
                        _lastShutdownTime[serverStatus.ServerCode] = DateTime.UtcNow;
                        break;
                    case false when serverStatus.IsActive:
                    {
                        // Server was offline and is now online, record the restart time.
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

                        _lastShutdownTime.Remove(serverStatus.ServerCode);
                        break;
                    }
                }
            }
            else
            {
                // First time seeing this server, just record its status.
                if (serverStatus.IsActive)
                    _lastShutdownTime.Remove(serverStatus.ServerCode);
                else
                    _lastShutdownTime[serverStatus.ServerCode] = DateTime.UtcNow;
            }

            // Always update the previous status so state transitions keep working.
            _prevServerStatus[serverStatus.ServerCode] = serverStatus.IsActive;
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
    ///     Uses a hybrid of interval and time-of-day pattern prediction to estimate the next restart.
    /// </summary>
    /// <param name="serverName">The name of the server to predict restart time for.</param>
    /// <param name="nowUtc">Optional reference time in UTC for deterministic prediction in tests.</param>
    /// <returns>The predicted next restart time, or null if there's insufficient data (less than 2 restarts).</returns>
    public DateTime? PredictNextRestart(string serverName, DateTime? nowUtc = null)
    {
        return PredictNextRestartWithConfidence(serverName, nowUtc).Time;
    }

    private PredictionResult PredictNextRestartWithConfidence(string serverName, DateTime? nowUtc = null)
    {
        if (!_serverRestartTimes.TryGetValue(serverName, out var restarts) || restarts.Length < 2)
            return new(null, null);

        var now = nowUtc ?? DateTime.UtcNow;

        var intervalPrediction = GetIntervalBasedPrediction(restarts, now, out var intervalConfidence);
        if (!intervalPrediction.HasValue)
            return new(null, null);

        var schedulePrediction = GetScheduleBasedPrediction(restarts, now, intervalPrediction.Value,
            out var scheduleConfidence);

        return schedulePrediction.HasValue
            ? new(schedulePrediction, scheduleConfidence)
            : new(intervalPrediction, intervalConfidence);
    }

    private static DateTime? GetIntervalBasedPrediction(ServerRestartData[] restarts, DateTime now,
        out double confidence)
    {
        confidence = 0;

        var durations = new List<TimeSpan>();
        for (var i = 1; i < restarts.Length; i++)
            durations.Add(restarts[i].RestartTime - restarts[i - 1].RestartTime);

        if (durations.Count == 0)
            return null;

        // Median interval is more robust against occasional long outages than arithmetic mean.
        var orderedTicks = durations.Select(d => d.Ticks).OrderBy(x => x).ToArray();
        long medianTicks;
        if (orderedTicks.Length % 2 == 1)
            medianTicks = orderedTicks[orderedTicks.Length / 2];
        else
            medianTicks = (orderedTicks[orderedTicks.Length / 2 - 1] + orderedTicks[orderedTicks.Length / 2]) / 2;

        var interval = TimeSpan.FromTicks(medianTicks);
        if (interval <= TimeSpan.Zero)
            return null;

        var meanTicks = durations.Average(d => d.Ticks);
        var stdTicks = Math.Sqrt(durations.Average(d => Math.Pow(d.Ticks - meanTicks, 2)));
        var cv = meanTicks <= 0 ? 1 : stdTicks / meanTicks;

        var sampleScore = Clamp01(durations.Count / 6d);
        var stabilityScore = Clamp01(1 - cv / 1.5);
        confidence = Math.Round(Clamp01(sampleScore * stabilityScore), 2);

        var nextRestart = restarts[^1].RestartTime + interval;
        while (nextRestart <= now)
            nextRestart += interval;

        return nextRestart;
    }

    private static DateTime? GetScheduleBasedPrediction(ServerRestartData[] restarts, DateTime now,
        DateTime intervalPrediction, out double confidence)
    {
        confidence = 0;

        if (restarts.Length < 4)
            return null;

        const int bucketMinutes = 15;

        var grouped = restarts
            .GroupBy(r => RoundMinutesOfDay(r.RestartTime.TimeOfDay, bucketMinutes))
            .Select(g => new { MinuteOfDay = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.MinuteOfDay)
            .ToArray();

        var strongBuckets = grouped.Where(x => x.Count >= 2).Take(3).ToArray();
        if (strongBuckets.Length == 0)
            return null;

        var covered = strongBuckets.Sum(x => x.Count);
        var coverageConfidence = (double)covered / restarts.Length;
        if (coverageConfidence < 0.6)
            return null;

        var candidates = strongBuckets
            .Select(b => NextOccurrence(now, b.MinuteOfDay))
            .Where(c => c > now)
            .OrderBy(c => c)
            .ToArray();

        if (candidates.Length == 0)
            return null;

        var scheduleCandidate = candidates[0];

        // Prefer schedule candidate when pattern confidence is strong or close to interval estimate.
        var delta = (scheduleCandidate - intervalPrediction).Duration();
        if (coverageConfidence >= 0.75 || delta <= TimeSpan.FromHours(6))
        {
            var closenessConfidence = Clamp01(1 - delta.TotalHours / 12d);
            confidence = Math.Round(Clamp01(0.7 * coverageConfidence + 0.3 * closenessConfidence), 2);
            return scheduleCandidate;
        }

        return null;
    }

    private static double Clamp01(double value)
    {
        return Math.Max(0, Math.Min(1, value));
    }

    private static int RoundMinutesOfDay(TimeSpan timeOfDay, int bucketMinutes)
    {
        var totalMinutes = (int)Math.Round(timeOfDay.TotalMinutes / bucketMinutes) * bucketMinutes;
        var minutesPerDay = 24 * 60;
        totalMinutes %= minutesPerDay;
        if (totalMinutes < 0)
            totalMinutes += minutesPerDay;
        return totalMinutes;
    }

    private static DateTime NextOccurrence(DateTime now, int minuteOfDay)
    {
        var dayStart = new DateTime(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);
        var candidate = dayStart.AddMinutes(minuteOfDay);
        if (candidate <= now)
            candidate = candidate.AddDays(1);
        return candidate;
    }

    /// <summary>
    ///     Gets the next restart prediction data for a specific server.
    /// </summary>
    public ServerRestartPrediction GetNextRestartPrediction(string serverName)
    {
        var prediction = PredictNextRestartWithConfidence(serverName);
        return new(serverName, prediction.Time, prediction.Confidence);
    }

    /// <summary>
    ///     Gets the next restart prediction data for all known servers.
    /// </summary>
    public ServerRestartPrediction[] GetNextRestartPredictions()
    {
        var serverCodes = serverDataService.Data?.Select(x => x.ServerCode).Distinct().ToArray() ?? [];
        return serverCodes.Select(GetNextRestartPrediction).ToArray();
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

    private readonly record struct PredictionResult(DateTime? Time, double? Confidence);

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