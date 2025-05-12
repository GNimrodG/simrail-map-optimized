using System.Diagnostics;
using Prometheus;
using SMOBackend.Models;
using SMOBackend.Models.Trains;
using SMOBackend.Services;
using SMOBackend.Utils;

namespace SMOBackend.Analytics;

/// <summary>
/// Service to analyze train delays.
/// </summary>
public class TrainDelayAnalyzerService(
    ILogger<TrainDelayAnalyzerService> logger,
    IServiceScopeFactory scopeFactory,
    TimeDataService timeDataService,
    TrainDataService trainDataService,
    TimetableDataService timetableDataService) : IHostedService
{
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "delays");
    private static readonly string LastTimetableIndexFile = Path.Combine(DataDirectory, "lastTimetableIndex.bin");
    private static readonly string TrainDelaysFile = Path.Combine(DataDirectory, "trainDelays.bin");

    private readonly TtlCache<string, short> _lastTimetableIndex = new(TimeSpan.FromMinutes(30));
    private readonly TtlCache<string, Dictionary<short, ushort>> _trainDelays = new(TimeSpan.FromMinutes(30));

    /// <inheritdoc />
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Starting timetable data service...");
        Directory.CreateDirectory(DataDirectory);

        try
        {
            if (File.Exists(LastTimetableIndexFile))
                _lastTimetableIndex.LoadFromFile(LastTimetableIndexFile);

            // Delete leftover tmp files
            if (File.Exists(LastTimetableIndexFile + ".tmp"))
                File.Delete(LastTimetableIndexFile + ".tmp");
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Failed to load last timetable index from file {LastTimetableIndexFile}",
                LastTimetableIndexFile);
        }

        try
        {
            if (File.Exists(TrainDelaysFile))
                _trainDelays.LoadFromFile(TrainDelaysFile);

            // Delete leftover tmp files
            if (File.Exists(TrainDelaysFile + ".tmp"))
                File.Delete(TrainDelaysFile + ".tmp");
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Failed to load train delays from file {TrainDelaysFile}",
                TrainDelaysFile);
        }

        logger.LogInformation("Timetable data service started");

        logger.LogInformation("Waiting for time data...");
        await timeDataService.FirstDataReceived;
        logger.LogInformation("Time data is now available, starting train delay analyzer...");

        trainDataService.DataReceived += AnalyzeTrains;
        logger.LogInformation("Train delay analyzer started");

        // Save the last timetable index and train delays to file every 5 minutes in the background
        var thread = new Thread(async void () =>
        {
            try
            {
                using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
                while (!cancellationToken.IsCancellationRequested)
                {
                    await timer.WaitForNextTickAsync(cancellationToken);
                    await _lastTimetableIndex.SaveToFileAsync(LastTimetableIndexFile);
                    await _trainDelays.SaveToFileAsync(TrainDelaysFile);
                    logger.LogInformation("Saved last timetable index and train delays to file");
                }
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error saving last timetable index and train delays to file");
                File.Delete(LastTimetableIndexFile);
                File.Delete(TrainDelaysFile);
            }
        });

        thread.Start();
    }

    /// <inheritdoc />
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        trainDataService.DataReceived -= AnalyzeTrains;
        await _lastCancellationTokenSource?.CancelAsync();
        _lastCancellationTokenSource?.Dispose();
        logger.LogInformation("Train delay analyzer stopped");

        logger.LogInformation("Saving last timetable index and train delays to file...");
        await _lastTimetableIndex.SaveToFileAsync(LastTimetableIndexFile);
        await _trainDelays.SaveToFileAsync(TrainDelaysFile);
        logger.LogInformation("Saved last timetable index and train delays to file");
    }

    /// <summary>
    /// Get the delays for the specified trains.
    /// </summary>
    public Dictionary<string, Dictionary<short, ushort>> GetDelaysForTrains(Train[] trains)
    {
        var delays = new Dictionary<string, Dictionary<short, ushort>>();

        foreach (var train in trains)
        {
            if (_trainDelays.TryGetValue(train.GetTrainId(), out var trainDelays))
            {
                delays[train.Id] = trainDelays;
            }
        }

        return delays;
    }

    /// <summary>
    /// Get the delays for the specified train.
    /// </summary>
    public Dictionary<short, ushort> GetDelaysForTrain(Train train) =>
        _trainDelays.TryGetValue(train.GetTrainId(), out var trainDelays) ? trainDelays : new();

    private bool _isRunning;
    private CancellationTokenSource? _lastCancellationTokenSource;

    private async void AnalyzeTrains(Dictionary<string, Train[]> trains)
    {
        try
        {
            if (_isRunning)
            {
                logger.LogWarning("Train delay analyzer is already running");
                return;
            }

            _isRunning = true;
            _lastCancellationTokenSource = new();
            var cancellationToken = _lastCancellationTokenSource.Token;

            logger.LogInformation("Processing trains...");

            var stopwatch = Stopwatch.StartNew();
            stopwatch.Start();

            var serverTimes = GetServerTimes();
            if (serverTimes == null)
            {
                logger.LogError("Failed to get server times");
                _isRunning = false;
                return;
            }

            var allTrains = trains.SelectMany(x => x.Value).ToArray();
            await ProcessTrains(allTrains, serverTimes, cancellationToken);

            stopwatch.Stop();
            logger.LogInformation("Processed {TrainCount} trains in {ElapsedMilliseconds} ms",
                trains.SelectMany(x => x.Value).Count(), stopwatch.ElapsedMilliseconds);

            _isRunning = false;

            await scopeFactory.LogStat(
                "TRAIN-DELAY",
                (int)stopwatch.ElapsedMilliseconds,
                allTrains.Length,
                _trainDelays.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error analyzing trains");
            _isRunning = false;
        }
    }

    private Dictionary<string, long>? GetServerTimes() =>
        timeDataService.Data?.ToDictionary(x => x.Key, x => CalculateServerTime(x.Value));

    private static long CalculateServerTime(TimeData timeData)
    {
        // Convert server time to current UTC time by:
        // 1. Taking the server's reported time
        // 2. Adding elapsed time since last update
        // 3. Adjusting for timezone offset
        return timeData.Time +
               (long)(DateTime.UtcNow - timeData.LastUpdated)
               .TotalMilliseconds -
               timeData.Timezone * 60 * 60 * 1000;
    }

    private async Task ProcessTrains(Train[] trains, Dictionary<string, long> serverTimes,
        CancellationToken cancellationToken)
    {
        await Parallel.ForEachAsync(
            trains,
            new ParallelOptions { MaxDegreeOfParallelism = 16, CancellationToken = cancellationToken },
            async (train, token) =>
            {
                try
                {
                    await ProcessTrain(train, serverTimes, token);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error processing train {TrainId}", train.GetTrainId());
                }

                _lastTimetableIndex.Set(train.GetTrainId(), train.TrainData.VDDelayedTimetableIndex);
            });

        foreach (var serverCode in serverTimes.Keys)
        {
            var serverTrains = trainDataService[serverCode];

            if (serverTrains == null || serverTrains.Length == 0)
            {
                logger.LogWarning("No trains found for server {ServerCode}", serverCode);
                continue;
            }

            if (serverTrains.Length > 0)
            {
                var delayData = serverTrains
                    .Select(t =>
                        _trainDelays.TryGetValue(t.GetTrainId(), out var delays)
                            ? delays.Values.LastOrDefault()
                            : (int?)null)
                    .Where(x => x is not null).ToArray();

                ServerPunctualityGauge.WithLabels(serverCode).Set(delayData.Length > 0
                    ? delayData.Average(x => x!.Value)
                    : 0);
            }
            else
                ServerPunctualityGauge.WithLabels(serverCode).Set(0);
        }
    }

    private async Task ProcessTrain(Train train, Dictionary<string, long> serverTimes,
        CancellationToken cancellationToken)
    {
        if (!_lastTimetableIndex.TryGetValue(train.GetTrainId(), out var lastTimetableIndex) ||
            train.TrainData.VDDelayedTimetableIndex <= lastTimetableIndex) return;

        var schedule =
            await timetableDataService.GetTimetableForTrainAsync(train.ServerCode, train.TrainNoLocal,
                cancellationToken);
        if (schedule == null)
        {
            logger.LogWarning("No schedule found for train {TrainId}", train.GetTrainId());
            return;
        }

        var lastStation = schedule.TimetableEntries.Length > lastTimetableIndex
            ? schedule.TimetableEntries[lastTimetableIndex]
            : null;
        if (lastStation == null)
        {
            logger.LogWarning("No last station found for train {TrainId}", train.GetTrainId());
            return;
        }

        if (lastStation.DepartureTime == null)
        {
            logger.LogWarning("No departure time found for train {TrainId}", train.GetTrainId());
            return;
        }

        var timeData = timeDataService[train.ServerCode];
        if (timeData == null)
        {
            logger.LogWarning("No time data found for server {ServerCode}", train.ServerCode);
            return;
        }

        var scheduledTime = ParseScheduledTime(lastStation.DepartureTime, timeData.Timezone);
        var currentTime = serverTimes[train.ServerCode];

        var delay = (ushort)((currentTime - scheduledTime) / 1000); // Convert to seconds

        logger.LogDebug("Train {TrainId} is delayed by {DelayMins} mins at {NameOfPoint}",
            train.GetTrainId(), delay / 60, lastStation.NameOfPoint);

        var delays = _trainDelays.GetOrAdd(train.GetTrainId(), () => new());
        if (!delays.TryAdd(lastTimetableIndex, delay)) delays[lastTimetableIndex] = delay;
        _trainDelays.Set(train.GetTrainId(), delays);
    }

    private static long ParseScheduledTime(string timeStr, int timezoneHours)
    {
        // Parse "yyyy-mm-dd hh:mm:ss" format
        var parts = timeStr.Split(' ');
        if (parts.Length != 2)
            throw new FormatException($"Invalid time format: {timeStr}");
        var dateParts = parts[0].Split('-');
        var timeParts = parts[1].Split(':');
        if (dateParts.Length != 3 || timeParts.Length != 3)
            throw new FormatException($"Invalid time format: {timeStr}");
        var year = int.Parse(dateParts[0]);
        var month = int.Parse(dateParts[1]);
        var day = int.Parse(dateParts[2]);
        var hour = int.Parse(timeParts[0]);
        var minute = int.Parse(timeParts[1]);
        var second = int.Parse(timeParts[2]);
        var dateTime = new DateTime(year, month, day, hour, minute, second, DateTimeKind.Utc);
        // Adjust for timezone
        dateTime = dateTime.AddHours(-timezoneHours);

        // Convert to Unix time
        var unixTime = (long)(dateTime - DateTime.UnixEpoch).TotalMilliseconds;
        return unixTime;
    }

    private static readonly Gauge ServerPunctualityGauge = Metrics
        .CreateGauge("smo_server_punctuality", "Punctuality of the server", "server");
}