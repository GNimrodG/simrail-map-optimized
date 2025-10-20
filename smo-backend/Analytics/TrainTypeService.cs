using SMOBackend.Models;
using SMOBackend.Services;
using SMOBackend.Utils;

namespace SMOBackend.Analytics;

/// <summary>
/// Service that maintains a dictionary of train numbers to their train types.
/// </summary>
public class TrainTypeService : IHostedService
{
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "train-types");
    private static readonly string TrainTypesFile = Path.Combine(DataDirectory, "train-types.bin");

    private readonly ILogger<TrainTypeService> _logger;
    private readonly TimetableDataService _timetableDataService;

    private readonly TtlCache<string, string> _trainTypeCache =
        new(TimeSpan.FromHours(24), "TrainTypeCache", maxEntries: 10000);

    private TimedFunction? _autoSaveFunction;

    public TrainTypeService(
        ILogger<TrainTypeService> logger,
        TimetableDataService timetableDataService)
    {
        _logger = logger;
        _timetableDataService = timetableDataService;
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting train type service...");

        try
        {
            Directory.CreateDirectory(DataDirectory);
            if (File.Exists(TrainTypesFile))
            {
                _trainTypeCache.LoadFromFile(TrainTypesFile);
                _logger.LogInformation("Loaded {Count} train types from {FilePath}",
                    _trainTypeCache.Count, TrainTypesFile);
            }
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Failed to load train types from file");
        }

        _timetableDataService.PerServerDataReceived += OnTimetableDataReceived;

        // Auto-save every 5 minutes
        _autoSaveFunction = new(SaveTrainTypes, TimeSpan.FromMinutes(5));

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping train type service...");

        _timetableDataService.PerServerDataReceived -= OnTimetableDataReceived;
        _autoSaveFunction?.Dispose();

        await SaveTrainTypesAsync().NoContext();
    }

    private void OnTimetableDataReceived(PerServerData<Timetable[]> data)
    {
        try
        {
            var added = 0;
            var updated = 0;

            foreach (var timetable in data.Data)
            {
                if (string.IsNullOrWhiteSpace(timetable.TrainNoLocal))
                    continue;

                // Extract train type from the first timetable entry
                var trainType = timetable.TimetableEntries.FirstOrDefault()?.TrainType;

                if (string.IsNullOrWhiteSpace(trainType))
                    continue;

                if (_trainTypeCache.TryGetValue(timetable.TrainNoLocal, out var existingType))
                {
                    if (existingType == trainType) continue;

                    _trainTypeCache.Set(timetable.TrainNoLocal, trainType);
                    updated++;
                }
                else
                {
                    _trainTypeCache.Add(timetable.TrainNoLocal, trainType);
                    added++;
                }
            }

            if (added > 0 || updated > 0)
            {
                _logger.LogInformation(
                    "Updated train type cache for server {ServerCode}: {Added} added, {Updated} updated",
                    data.ServerCode, added, updated);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing timetable data for train types");
        }
    }

    /// <summary>
    /// Gets the train type for a given train number.
    /// </summary>
    /// <param name="trainNoLocal">The local train number.</param>
    /// <returns>The train type, or null if not found.</returns>
    public string? GetTrainType(string trainNoLocal) =>
        _trainTypeCache.TryGetValue(trainNoLocal, out var trainType) ? trainType : null;

    private void SaveTrainTypes()
    {
        try
        {
            _trainTypeCache.SaveToFileAsync(TrainTypesFile).Wait();
            _logger.LogDebug("Saved {Count} train types to {FilePath}",
                _trainTypeCache.Count, TrainTypesFile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save train types to file");
        }
    }

    private async Task SaveTrainTypesAsync()
    {
        try
        {
            await _trainTypeCache.SaveToFileAsync(TrainTypesFile).NoContext();
            _logger.LogInformation("Saved {Count} train types to {FilePath}",
                _trainTypeCache.Count, TrainTypesFile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save train types to file");
        }
    }
}