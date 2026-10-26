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

    /// <summary>
    ///     The servers restart on a schedule in Polish local time, so the schedule is learned in it (DST-safe).
    /// </summary>
    private static readonly TimeZoneInfo ScheduleTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

    /// <summary>
    ///     How far back the restart schedule is learned from.
    /// </summary>
    private static readonly TimeSpan ScheduleWindow = TimeSpan.FromDays(28);

    /// <summary>
    ///     Restarts closer than this to the previous one belong to the same restart (servers often restart twice).
    /// </summary>
    private static readonly TimeSpan BurstWindow = TimeSpan.FromMinutes(20);

    /// <summary>
    ///     Restarts on the same weekday further apart than this (in time of day) are different slots.
    /// </summary>
    private const int SlotGapMinutes = 20;

    /// <summary>
    ///     A restart counts as a hit for a slot when it's at most this far from the slot's time.
    /// </summary>
    private const int SlotToleranceMinutes = 15;

    /// <summary>
    ///     A slot is part of the schedule when it had a restart on at least this share of its weekdays.
    /// </summary>
    private const double MinSlotConfidence = 0.5;

    /// <summary>
    ///     A weekday needs at least this many full observed days before its slots are trusted.
    /// </summary>
    private const int MinObservedWeekdays = 2;

    /// <summary>
    ///     Restarts older than this are dropped from the history.
    /// </summary>
    private static readonly TimeSpan MaxHistoryAge = TimeSpan.FromDays(90);

    // long enough for any outage (e.g. update days), a restart is only recorded when its shutdown is still known
    private readonly TtlCache<string, DateTime> _lastShutdownTime = new(TimeSpan.FromDays(7), "LastShutdownTime");

    private readonly TtlCache<string, bool> _prevServerStatus = new(TimeSpan.FromMinutes(5), "PreviousServerStatus");

    // no expiry, a server can be offline for a long time; the history itself is pruned to MaxHistoryAge
    private readonly TtlCache<string, ServerRestartData[]> _serverRestartTimes = new(null, "ServerRestartTimes");

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
                            var restarts = _serverRestartTimes.TryGetValue(serverStatus.ServerCode, out var known)
                                ? known
                                : [];

                            _serverRestartTimes[serverStatus.ServerCode] = restarts
                                .Where(r => restartTime - r.RestartTime <= MaxHistoryAge)
                                .Append(restartData)
                                .ToArray();

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
    ///     Predicts the next restart time for a server from its learned restart schedule.
    /// </summary>
    /// <param name="serverName">The name of the server to predict restart time for.</param>
    /// <param name="nowUtc">Optional reference time in UTC for deterministic prediction in tests.</param>
    /// <returns>The predicted next restart time, or null if the server has no reliable restart schedule.</returns>
    public DateTime? PredictNextRestart(string serverName, DateTime? nowUtc = null)
    {
        return PredictNextRestartWithConfidence(serverName, nowUtc).Time;
    }

    private PredictionResult PredictNextRestartWithConfidence(string serverName, DateTime? nowUtc = null)
    {
        return _serverRestartTimes.TryGetValue(serverName, out var restarts)
            ? PredictFromHistory(restarts, nowUtc ?? DateTime.UtcNow)
            : new(null, null);
    }

    /// <summary>
    ///     Predicts the next restart from the restart history.
    ///     The servers restart at fixed times of day in Polish local time, some only on certain weekdays. For every
    ///     weekday the restarts of the last <see cref="ScheduleWindow" /> are grouped into slots (times of day), and a slot
    ///     is part of the schedule when it had a restart on most of those weekdays (the official times are 01:30 and
    ///     09:30, but most servers also restart at ~02:48 on weekdays, and some servers have their own times).
    ///     The prediction is the next slot of the schedule. Schedule confidence is the share of past weekdays the slot
    ///     had a restart on. Overall confidence additionally accounts for the chance that no restart outside the
    ///     schedule (updates, crashes) comes first. On the real history, predictions with an overall confidence of at
    ///     least 0.9 were right (within 15 minutes) 91% of the time.
    /// </summary>
    internal static PredictionResult PredictFromHistory(IEnumerable<ServerRestartData> history, DateTime nowUtc)
    {
        var windowStart = nowUtc - ScheduleWindow;

        // the first restart of each burst
        var restarts = new List<DateTime>();
        DateTime? previous = null;
        foreach (var restartTime in history.Select(r => r.RestartTime)
                     .Where(t => t >= windowStart && t <= nowUtc)
                     .Order())
        {
            if (previous == null || restartTime - previous.Value > BurstWindow)
                restarts.Add(restartTime);
            previous = restartTime;
        }

        if (restarts.Count == 0) return new(null, null);

        var localRestarts = restarts.Select(t => TimeZoneInfo.ConvertTimeFromUtc(t, ScheduleTimeZone)).ToArray();
        var today = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, ScheduleTimeZone).Date;

        // only whole days are observed: from the day after the first known restart until yesterday
        var observedDays = new List<DateTime>();
        for (var day = localRestarts[0].Date.AddDays(1); day < today; day = day.AddDays(1))
            observedDays.Add(day);

        var schedule = new Dictionary<DayOfWeek, List<(int Minute, double Confidence)>>();
        var unscheduledRate = new double[7, 24];
        var unscheduledRestarts = new List<(DayOfWeek Weekday, int Hour)>();
        var observedHours = 0;
        foreach (var weekdayDays in observedDays.GroupBy(d => d.DayOfWeek))
        {
            var dayCount = weekdayDays.Count();
            if (dayCount < MinObservedWeekdays) continue;

            var days = weekdayDays.ToHashSet();
            var restartsOnWeekday = localRestarts
                .Where(t => days.Contains(t.Date))
                .Select(t => (Day: t.Date, Minute: (int)t.TimeOfDay.TotalMinutes))
                .OrderBy(t => t.Minute)
                .ToArray();

            foreach (var slot in SplitIntoSlots(restartsOnWeekday))
            {
                var minute = slot[slot.Count / 2].Minute; // median
                var hitDays = restartsOnWeekday
                    .Where(t => Math.Abs(t.Minute - minute) <= SlotToleranceMinutes)
                    .Select(t => t.Day)
                    .Distinct()
                    .Count();

                var confidence = (double)hitDays / dayCount;
                if (confidence < MinSlotConfidence) continue;

                if (!schedule.TryGetValue(weekdayDays.Key, out var slots))
                    schedule[weekdayDays.Key] = slots = [];
                slots.Add((minute, confidence));
            }

            // how often there was a restart outside the schedule in each hour of this weekday (updates, crashes)
            var weekdaySlots = schedule.GetValueOrDefault(weekdayDays.Key) ?? [];
            var unscheduled = restartsOnWeekday
                .Where(t => !weekdaySlots.Any(s => Math.Abs(t.Minute - s.Minute) <= SlotToleranceMinutes))
                .ToArray();
            foreach (var hourDays in unscheduled.GroupBy(t => t.Minute / 60))
                unscheduledRate[(int)weekdayDays.Key, hourDays.Key] =
                    (double)hourDays.Select(t => t.Day).Distinct().Count() / dayCount;

            unscheduledRestarts.AddRange(unscheduled.Select(t => (weekdayDays.Key, t.Minute / 60)));
            observedHours += dayCount * 24;
        }

        // A few weeks are too few to see random restarts (crashes) in every hour of every weekday, so every hour gets
        // at least the average rate of them. Hours with regular extra restarts (e.g. update days) are left out of the
        // average, they have their own rate.
        if (observedHours > 0)
        {
            var backgroundRate = unscheduledRestarts
                .Count(r => unscheduledRate[(int)r.Weekday, r.Hour] < MinSlotConfidence) / (double)observedHours;
            for (var weekday = 0; weekday < 7; weekday++)
            for (var hour = 0; hour < 24; hour++)
                unscheduledRate[weekday, hour] = Math.Max(unscheduledRate[weekday, hour], backgroundRate);
        }

        for (var day = today; day <= today.AddDays(7); day = day.AddDays(1))
        {
            if (!schedule.TryGetValue(day.DayOfWeek, out var slots)) continue;

            foreach (var (minute, slotConfidence) in slots.OrderBy(s => s.Minute))
            {
                var localTime = day.AddMinutes(minute);
                if (ScheduleTimeZone.IsInvalidTime(localTime)) continue; // skipped by the DST change

                // a slot is still due a little after its time, the restarts are often a few minutes late
                var predicted = TimeZoneInfo.ConvertTimeToUtc(localTime, ScheduleTimeZone);
                if (predicted + TimeSpan.FromMinutes(SlotToleranceMinutes) <= nowUtc) continue;

                // the restart of this slot already happened
                if (restarts.Any(t => (predicted - t).Duration() <= TimeSpan.FromMinutes(SlotToleranceMinutes)))
                    continue;

                // the prediction is right when the slot's restart happens and nothing else restarts the server first
                var confidence = slotConfidence * NoUnscheduledRestartChance(unscheduledRate, nowUtc,
                    predicted - TimeSpan.FromMinutes(SlotToleranceMinutes));

                return new(predicted, Math.Round(confidence, 2), Math.Round(slotConfidence, 2));
            }
        }

        return new(null, null);
    }

    /// <summary>
    ///     The chance that there is no restart outside the schedule between <paramref name="fromUtc" /> and
    ///     <paramref name="toUtc" />, from the observed rate of such restarts in each hour of each weekday.
    /// </summary>
    private static double NoUnscheduledRestartChance(double[,] unscheduledRate, DateTime fromUtc, DateTime toUtc)
    {
        const int stepMinutes = 15;
        var chance = 1.0;

        for (var t = fromUtc; t < toUtc; t = t.AddMinutes(stepMinutes))
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(t, ScheduleTimeZone);
            var hourRate = unscheduledRate[(int)local.DayOfWeek, local.Hour];
            if (hourRate <= 0) continue;

            // the share of the step that is in the interval, so that the whole hour multiplies to (1 - hourRate)
            var stepShare = Math.Min(stepMinutes, (toUtc - t).TotalMinutes) / 60;
            chance *= Math.Pow(1 - Math.Min(hourRate, 1), stepShare);
        }

        return chance;
    }

    /// <summary>
    ///     Splits restarts ordered by time of day into slots where they are at most <see cref="SlotGapMinutes" /> apart.
    /// </summary>
    private static List<List<(DateTime Day, int Minute)>> SplitIntoSlots((DateTime Day, int Minute)[] restarts)
    {
        var slots = new List<List<(DateTime Day, int Minute)>>();
        foreach (var restart in restarts)
        {
            if (slots.Count == 0 || restart.Minute - slots[^1][^1].Minute > SlotGapMinutes)
                slots.Add([]);
            slots[^1].Add(restart);
        }

        return slots;
    }

    /// <summary>
    ///     Gets the next restart prediction data for a specific server.
    /// </summary>
    public ServerRestartPrediction GetNextRestartPrediction(string serverName)
    {
        var prediction = PredictNextRestartWithConfidence(serverName);
        return new(serverName, prediction.Time, prediction.Confidence, prediction.ScheduleConfidence);
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

    internal readonly record struct PredictionResult(DateTime? Time, double? Confidence,
        double? ScheduleConfidence = null);

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
