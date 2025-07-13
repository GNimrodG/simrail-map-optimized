using Newtonsoft.Json;
using Prometheus;
using SMOBackend.Models;
using SMOBackend.Services;
using SMOBackend.Utils;

namespace SMOBackend.Analytics;

/// <summary>
/// Service to analyze and manage station data.
/// </summary>
public class StationAnalyzerService : IHostedService
{
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "stations");
    private static readonly string StationsFilePath = Path.Combine(DataDirectory, "stations.json");
    private static readonly string NotFoundStationsFilePath = Path.Combine(DataDirectory, "not-found-stations.json");

    private static readonly Gauge StationCountGauge = Metrics
        .CreateGauge("smo_known_station_count", "Number of known stations loaded from the data file");

    private static readonly Gauge NotFoundCountGauge = Metrics
        .CreateGauge("smo_not_found_station_count", "Number of stations that were not found in OSM");

    private static readonly Gauge StationTimetableAnalyzerQueueGauge = Metrics
        .CreateGauge("smo_station_timetable_analyzer_queue_length", "Length of the station timetable analyzer queue");

    private readonly HashSet<string> _enqueuedStations = [];

    private readonly Lock _lock = new();

    private readonly ILogger<StationAnalyzerService> _logger;

    private readonly HashSet<string> _notFoundStations = [];
    private readonly OsmApiClient _osmApiClient;

    private readonly QueueProcessor<TimetableEntry> _queueProcessor;
    private readonly StationDataService _stationDataService;
    private readonly TimetableDataService _timetableDataService;

    private TimedFunction? _autoSaveFunction;
    private List<Station> _stations = [];

    /// <summary>
    /// Service to analyze and manage station data.
    /// </summary>
    public StationAnalyzerService(ILogger<StationAnalyzerService> logger,
        StationDataService stationDataService,
        TimetableDataService timetableDataService,
        OsmApiClient osmApiClient)
    {
        _logger = logger;
        _stationDataService = stationDataService;
        _timetableDataService = timetableDataService;
        _osmApiClient = osmApiClient;
        _queueProcessor = new(logger,
            ProcessStation,
            StationTimetableAnalyzerQueueGauge,
            5,
            -1);
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        LoadStations();
        lock (_lock)
        {
            _logger.LogInformation("Loaded {StationCount} stations from {FilePath}", _stations.Count, StationsFilePath);
        }

        _stationDataService.DataReceived += OnStationDataReceived;
        _timetableDataService.PerServerDataReceived += OnTimetableDataReceived;

        _autoSaveFunction = new(SaveStations, TimeSpan.FromMinutes(5));

        return Task.CompletedTask;
    }


    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken)
    {
        SaveStations();
        SaveNotFoundStations();

        lock (_lock)
        {
            _logger.LogInformation("Saved {StationCount} stations to {FilePath}", _stations.Count, StationsFilePath);
            _logger.LogInformation("Saved {NotFoundCount} not found stations to {FilePath}",
                _notFoundStations.Count, NotFoundStationsFilePath);
        }

        _stationDataService.DataReceived -= OnStationDataReceived;
        _timetableDataService.PerServerDataReceived -= OnTimetableDataReceived;
        _queueProcessor.ClearQueue();

        _autoSaveFunction?.Dispose();

        return Task.CompletedTask;
    }

    private void OnStationDataReceived(Dictionary<string, Station[]> data)
    {
        lock (_lock)
        {
            foreach (var station in data.SelectMany(station => station.Value))
            {
                // Check if the station already exists
                var existingStation = _stations.FirstOrDefault(s => s.Id == station.Id);
                if (existingStation != null)
                {
                    // Update existing station if values have changed and log each update
                    UpdatePropertyIfChanged(existingStation, station, "Id");
                    UpdatePropertyIfChanged(existingStation, station, "Name");
                    UpdatePropertyIfChanged(existingStation, station, "Prefix");
                    UpdatePropertyIfChanged(existingStation, station, "DifficultyLevel");
                    UpdatePropertyIfChanged(existingStation, station, "MainImageUrl");
                    UpdatePropertyIfChanged(existingStation, station, "AdditionalImage1Url");
                    UpdatePropertyIfChanged(existingStation, station, "AdditionalImage2Url");
                    UpdatePropertyIfChanged(existingStation, station, "Latitude");
                    UpdatePropertyIfChanged(existingStation, station, "Longitude");
                }
                else
                {
                    // Add new station
                    _stations.Add(new()
                    {
                        Id = station.Id,
                        Name = station.Name,
                        Prefix = station.Prefix,
                        DifficultyLevel = station.DifficultyLevel,
                        MainImageUrl = station.MainImageUrl,
                        AdditionalImage1Url = station.AdditionalImage1Url,
                        AdditionalImage2Url = station.AdditionalImage2Url,
                        Latitude = station.Latitude,
                        Longitude = station.Longitude,
                        DispatchedBy = []
                    });
                }
            }
        }

        SaveStations();
    }

    private void UpdatePropertyIfChanged(
        Station existingStation,
        Station newStation,
        string propertyName)
    {
        // Get the property info using reflection
        var propertyInfo = typeof(Station).GetProperty(propertyName);

        if (propertyInfo == null)
        {
            _logger.LogWarning("Property {PropertyName} not found on Station type", propertyName);
            return;
        }

        // Get the old and new values
        var oldValue = propertyInfo.GetValue(existingStation);
        var newValue = propertyInfo.GetValue(newStation);

        // Compare values
        if (Equals(oldValue, newValue)) return;

        // Log the change
        _logger.LogInformation("Station {Id}: {Property} updated from {Old} to {New}",
            newStation.Id, propertyName, oldValue, newValue);

        // Set the new value
        propertyInfo.SetValue(existingStation, newValue);
    }

    private void OnTimetableDataReceived(PerServerData<Timetable[]> data)
    {
        try
        {
            var stations = data.Data
                .SelectMany(timetable => timetable.TimetableEntries)
                .DistinctBy(x => x.PointId).ToArray();

            foreach (var station in stations)
            {
                if (string.IsNullOrWhiteSpace(station.NameOfPoint) || string.IsNullOrWhiteSpace(station.PointId))
                {
                    _logger.LogWarning("Skipping station with empty name or point ID: {Station}",
                        JsonConvert.SerializeObject(station));
                    continue;
                }

                if (_enqueuedStations.Contains(station.NameOfPoint))
                {
                    _logger.LogDebug("Station {StationName} with PointId {PointId} already enqueued, skipping",
                        station.NameOfPoint, station.PointId);
                    continue;
                }

                _queueProcessor.Enqueue(station);
                _enqueuedStations.Add(station.NameOfPoint);
            }
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error processing timetable data for server {ServerCode}", data.ServerCode);
        }
    }

    private async Task ProcessStation(TimetableEntry station)
    {
        Station? existingStation;

        lock (_lock)
        {
            existingStation = _stations.FirstOrDefault(s => s.Name == station.NameOfPoint)
                              ?? _stations.FirstOrDefault(s => s.Prefix.StartsWith(station.PointId + "_"));
        }

        switch (existingStation)
        {
            case { PointId: null }:
                // Update existing station with PointId if it was null
                existingStation.PointId = station.PointId;
                _logger.LogInformation("Set point id {PointId} for station {StationName} with ID {StationId}",
                    station.PointId, existingStation.Name, existingStation.Id);
                break;
            case null:
                try
                {
                    if (_notFoundStations.Contains(station.NameOfPoint))
                    {
                        _logger.LogWarning("Skipping station {StationName} as it was previously not found",
                            station.NameOfPoint);
                        return;
                    }

                    _logger.LogInformation("Fetching OSM data for station {StationName}", station.NameOfPoint);
                    var osmData = await _osmApiClient.GetSignalBoxByNameAsync(station.NameOfPoint);

                    if (osmData == null)
                    {
                        var altName = station.NameOfPoint
                            .Replace("Much.", "Muchowiec ")
                            .Replace("M.", "Muchowiec ")
                            .Replace("M ", "Muchowiec ")
                            .Replace("P.", "Południowa ")
                            .Replace("P ", "Południowa ")
                            .Replace("Tow ", "Towarowa ")
                            .Replace("Tow.", "Towarowa ")
                            .Replace("Gł.", "Główny ")
                            .Replace("Dąbr.", "Dąbrowa ")
                            .Replace("Górn.", "Górnicza ")
                            .Replace("Maz.", "Mazowiecki ")
                            .Replace("Zach.", "Zachodnia ")
                            .Replace("Wsch.", "Wschodnia ")
                            .Replace("Kr.", "Kraków ")
                            .Replace("Żakow.", "Żakowice ")
                            .Replace("Zakow.", "Zakowice ")
                            .Replace("Kam.", "Kamienna ")
                            .Replace("Roz.", "Rozdroże ")
                            .Replace(".", "")
                            .Replace("  ", " ") // Normalize spaces
                            .Trim();

                        if (altName != station.NameOfPoint)
                        {
                            _logger.LogInformation("Trying alternative name {AltName} for station {StationName}",
                                altName, station.NameOfPoint);

                            osmData = await _osmApiClient.GetSignalBoxByNameAsync(altName);
                        }
                    }

                    if (osmData != null)
                    {
                        lock (_lock)
                        {
                            var railwayRef = osmData.Tags.GetValueOrDefault("railway:ref", string.Empty);

                            if (string.IsNullOrWhiteSpace(railwayRef) &&
                                osmData.Tags.TryGetValue("name", out var value) &&
                                value != station.NameOfPoint)
                            {
                                railwayRef = value.Replace(station.NameOfPoint, string.Empty).Trim();
                            }

                            var prefix = $"{station.PointId}_{railwayRef}";
                            var mainImageUrl = string.Empty;

                            if (osmData.Tags.TryGetValue("wikimedia_commons", out var tagValue) &&
                                tagValue.StartsWith("File:"))
                            {
                                mainImageUrl =
                                    $"https://commons.wikimedia.org/wiki/Special:Redirect/file/{osmData.Tags["wikimedia_commons"]}";
                            }

                            // Create a new station if it doesn't exist
                            var newStation = new Station
                            {
                                Id = Guid.NewGuid().ToString(),
                                Name = station.NameOfPoint,
                                Prefix = prefix,
                                DifficultyLevel = -1,
                                MainImageUrl = string.IsNullOrWhiteSpace(mainImageUrl) ? null : mainImageUrl,
                                AdditionalImage1Url = null,
                                AdditionalImage2Url = null,
                                Latitude = osmData.Center.Lat,
                                Longitude = osmData.Center.Lon,
                                PointId = station.PointId,
                            };

                            _stations.Add(newStation);
                            _logger.LogInformation(
                                "Added new station {StationName} with ID {StationId}",
                                newStation.Name, newStation.Id);
                        }
                    }
                    else
                    {
                        _notFoundStations.Add(station.NameOfPoint);
                        _logger.LogWarning("No OSM data found for station {StationName}",
                            station.NameOfPoint);
                        SaveNotFoundStations();
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Error fetching OSM data for station {StationName}",
                        station.NameOfPoint);
                }

                break;
        }

        SaveStations();
    }

    private void LoadStations()
    {
        lock (_lock)
        {
            if (!Directory.Exists(DataDirectory))
                Directory.CreateDirectory(DataDirectory);

            try
            {
                if (File.Exists(StationsFilePath))
                {
                    var json = File.ReadAllText(StationsFilePath);
                    _stations = JsonConvert.DeserializeObject<List<Station>>(json) ?? [];
                }
                else
                {
                    _stations = [];
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load stations from file {FilePath}", StationsFilePath);
                _stations = [];
            }

            _stations = _stations.DistinctBy(s => s.Name).ToList();

            StationCountGauge.Set(_stations.Count);

            try
            {
                if (File.Exists(NotFoundStationsFilePath))
                {
                    var notFoundJson = File.ReadAllText(NotFoundStationsFilePath);
                    _notFoundStations.UnionWith(JsonConvert.DeserializeObject<HashSet<string>>(notFoundJson) ?? []);
                }

                NotFoundCountGauge.Set(_notFoundStations.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load not found stations from file {FilePath}",
                    NotFoundStationsFilePath);
            }
        }
    }

    private void SaveStations()
    {
        lock (_lock)
        {
            try
            {
                if (!Directory.Exists(DataDirectory))
                    Directory.CreateDirectory(DataDirectory);

                var json = JsonConvert.SerializeObject(_stations, Formatting.Indented);
                var tempFilePath = StationsFilePath + ".tmp";
                File.WriteAllText(tempFilePath, json);
                File.Move(tempFilePath, StationsFilePath, true);
                StationCountGauge.Set(_stations.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save stations to file {FilePath}", StationsFilePath);
            }
        }
    }

    private void SaveNotFoundStations()
    {
        lock (_lock)
        {
            try
            {
                if (!Directory.Exists(DataDirectory))
                    Directory.CreateDirectory(DataDirectory);

                var notFoundJson = JsonConvert.SerializeObject(_notFoundStations, Formatting.Indented);
                var tempFilePath = NotFoundStationsFilePath + ".tmp";
                File.WriteAllText(tempFilePath, notFoundJson);
                File.Move(tempFilePath, NotFoundStationsFilePath, true);
                NotFoundCountGauge.Set(_notFoundStations.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save not found stations to file {FilePath}",
                    NotFoundStationsFilePath);
            }
        }
    }

    /// <summary>
    /// Retrieves all known stations.
    /// </summary>
    public Station[] GetStations()
    {
        lock (_lock)
        {
            return _stations.ToArray();
        }
    }

    /// <summary>
    /// Sets the known stations, replacing any existing stations.
    /// </summary>
    public void SetStations(Station[] stations)
    {
        lock (_lock)
        {
            _stations = stations.DistinctBy(s => s.Name).ToList();
            SaveStations();
            StationCountGauge.Set(_stations.Count);
        }
    }
}