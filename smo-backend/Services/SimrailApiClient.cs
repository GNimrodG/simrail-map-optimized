using Newtonsoft.Json;
using SMOBackend.Models;
using SMOBackend.Models.Entity;
using SMOBackend.Models.Trains;

namespace SMOBackend.Services;

/// <summary>
/// A client for the Simrail API.
/// </summary>
public class SimrailApiClient
{
    private const string ServersOpenUrl = "https://panel.simrail.eu:8084/servers-open";
    private const string TrainsUrlPrefix = "https://panel.simrail.eu:8084/trains-open?serverCode=";
    private const string TrainPositionsUrlPrefix = "https://panel.simrail.eu:8084/train-positions-open?serverCode=";
    private const string StationsUrlPrefix = "https://panel.simrail.eu:8084/stations-open?serverCode=";
    private const string TimezoneUrlPrefix = "https://api.simrail.eu:8082/api/getTimeZone?serverCode=";
    private const string TimeUrlPrefix = "https://api.simrail.eu:8082/api/getTime?serverCode=";
    private const string TimetableUrlPrefix = "https://api.simrail.eu:8082/api/getAllTimetables?serverCode=";
    private const string EdrTimetableUrlPrefix = "https://api1.aws.simrail.eu:8082/api/getEDRTimetables?serverCode=";

    private readonly HttpClient _httpClient = new();

    private static T[] HandleResponse<T>(HttpResponseMessage response, CancellationToken stoppingToken) where T : class
    {
        response.EnsureSuccessStatusCode();
        var content = response.Content.ReadAsStringAsync(stoppingToken).Result;
        var result = JsonConvert.DeserializeObject<BaseListResponse<T>>(content);

        if (result == null)
        {
            throw new("Response is null");
        }

        if (!result.Result)
        {
            throw new(result.Description);
        }

        if (response.Headers.Date == null || response.Headers.Age == null || result.Data.Length <= 0 ||
            result.Data[0] is not IEntityWithTimestamp) return result.Data;

        foreach (var item in result.Data)
        {
            ((IEntityWithTimestamp)item).Timestamp =
                response.Headers.Date!.Value.UtcDateTime - response.Headers.Age!.Value;
        }

        return result.Data;
    }

    /// <summary>
    /// Get the list of all servers.
    /// </summary>
    public async Task<ServerStatus[]> GetServersAsync(CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(ServersOpenUrl, stoppingToken);
        return HandleResponse<ServerStatus>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all trains on a server.
    /// </summary>
    public async Task<Train[]> GetTrainsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TrainsUrlPrefix + serverCode, stoppingToken);
        return HandleResponse<Train>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all train positions on a server.
    /// </summary>
    public async Task<TrainPosition[]> GetTrainPositionsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TrainPositionsUrlPrefix + serverCode, stoppingToken);
        return HandleResponse<TrainPosition>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all stations on a server.
    /// </summary>
    public async Task<Station[]> GetStationsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(StationsUrlPrefix + serverCode, stoppingToken);
        return HandleResponse<Station>(response, stoppingToken);
    }

    /// <summary>
    /// Get the unix epoch time of the server and the date of the response.
    /// </summary>
    public async Task<(long time, DateTime date)?> GetTimeAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TimeUrlPrefix + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        if (long.TryParse(content, out var time)) return (time, response.Headers.Date!.Value.DateTime);

        throw new(content);
    }

    /// <summary>
    /// Get the timezone offset of the server in hours.
    /// </summary>
    public async Task<int?> GetTimezoneAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TimezoneUrlPrefix + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        return int.TryParse(content, out var timezone) ? timezone : null;
    }

    /// <summary>
    /// Get the list of all timetables on a server.
    /// </summary>
    public async Task<Timetable[]> GetAllTimetablesAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TimetableUrlPrefix + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        var result = JsonConvert.DeserializeObject<Timetable[]>(content);

        if (result == null)
        {
            throw new("Response is null");
        }

        return result;
    }

    /// <summary>
    /// Get the list of all EDR timetables on a server.
    /// </summary>
    public async Task<EdrTimetableTrainEntry[]> GetEdrTimetablesAsync(string serverCode,
        CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(EdrTimetableUrlPrefix + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        var result = JsonConvert.DeserializeObject<EdrTimetableTrainEntry[]>(content);

        if (result == null)
        {
            throw new("Response is null");
        }

        return result;
    }
}