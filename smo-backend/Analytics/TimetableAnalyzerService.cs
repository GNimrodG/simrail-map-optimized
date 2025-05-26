using System.Diagnostics;
using SMOBackend.Models;
using SMOBackend.Services;
using SMOBackend.Utils;

namespace SMOBackend.Analytics;

/// <summary>
/// Service for analyzing and processing timetable data.
/// </summary>
public class TimetableAnalyzerService(
    ILogger<TimetableAnalyzerService> logger,
    IServiceScopeFactory scopeFactory,
    TimetableDataService timetableDataService) : IHostedService
{
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "timetables");
    private static readonly string StationTimetableDataFile = Path.Combine(DataDirectory, "station-timetable-data.bin");
    
    private readonly TtlCache<string, Dictionary<string, SimplifiedTimetableEntry[]>> _timetableDataCache =
        new(timetableDataService.GetFetchInterval().Add(TimeSpan.FromMinutes(30)));

    public SimplifiedTimetableEntry[] GetTimetableEntries(string serverCode, string stationName)
    {
        if (!_timetableDataCache.TryGetValue(serverCode, out var timetableEntriesPerStation)) return [];

        return timetableEntriesPerStation.TryGetValue(stationName, out var timetableEntries) ? timetableEntries : [];
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Starting timetable data service...");
        
        try
        {
            Directory.CreateDirectory(DataDirectory);
            if (File.Exists(StationTimetableDataFile))
                _timetableDataCache.LoadFromFile(StationTimetableDataFile);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to load last timetable index from file");
        }
        
        timetableDataService.PerServerDataReceived += ProcessTimetableData;

        // Save the cache to file every 5 minutes in the background
        var thread = new Thread(async void () =>
        {
            try
            {
                using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
                while (!cancellationToken.IsCancellationRequested)
                {
                    await timer.WaitForNextTickAsync(cancellationToken);
                    await _timetableDataCache.SaveToFileAsync(StationTimetableDataFile);
                    logger.LogInformation("Saved timetable data to file");
                }
                
                await _timetableDataCache.SaveToFileAsync(StationTimetableDataFile);
                logger.LogInformation("Saved timetable data to file");
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error saving timetable data to file");
                File.Delete(StationTimetableDataFile);
            }
        });

        thread.Start();
        
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("Stopping timetable data service...");

        timetableDataService.PerServerDataReceived -= ProcessTimetableData;

        try
        {
            await _timetableDataCache.SaveToFileAsync(StationTimetableDataFile);
            logger.LogInformation("Saved timetable data to file");
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error saving timetable data to file");
        }
    }

    private async void ProcessTimetableData(PerServerData<Timetable[]> timetableData)
    {
        try
        {
            logger.LogInformation("Processing timetable data for server {ServerCode}...", timetableData.ServerCode);

            var stopwatch = Stopwatch.StartNew();
            stopwatch.Start();

            var timetableEntriesPerStation = timetableData.Data
                .SelectMany(x => x.TimetableEntries.Select((_, i) => new SimplifiedTimetableEntry(x, i)))
                .Where(x => x.SupervisedBy != null)
                .GroupBy(x => x.StationName)
                .ToDictionary(g => g.Key, g => g.ToArray());

            _timetableDataCache.Set(timetableData.ServerCode, timetableEntriesPerStation);

            stopwatch.Stop();
            logger.LogInformation("Processed timetable data for server {ServerCode} in {ElapsedMilliseconds} ms",
                timetableData.ServerCode, stopwatch.ElapsedMilliseconds);

            await scopeFactory.LogStat(
                "TIMETABLE-ANALYZE",
                (int)stopwatch.ElapsedMilliseconds,
                timetableData.Data.Length);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error processing train data for server {ServerCode}", timetableData.ServerCode);
        }
    }
}