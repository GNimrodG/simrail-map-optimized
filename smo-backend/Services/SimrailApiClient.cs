using System.Text.Json;
using SMOBackend.Models;
using SMOBackend.Models.Trains;

namespace SMOBackend.Services;

public class SimrailApiClient
{
    private const string SERVERS_OPEN_URL = "https://panel.simrail.eu:8084/servers-open";
    private const string TRAINS_URL_PREFIX = "https://panel.simrail.eu:8084/trains-open?serverCode=";
    private const string STATIONS_URL_PREFIX = "https://panel.simrail.eu:8084/stations-open?serverCode=";
    private const string TIMEZONE_URL_PREFIX = "https://api.simrail.eu:8082/api/getTimeZone?serverCode=";
    private const string TIME_URL_PREFIX = "https://api.simrail.eu:8082/api/getTime?serverCode=";
    private const string TIMETABLE_URL_PREFIX = "https://api.simrail.eu:8082/api/getAllTimetables?serverCode=";
    private const string EDR_TIMETABLE_URL_PREFIX = "https://api1.aws.simrail.eu:8082/api/getEDRTimetables?serverCode=";

    private readonly HttpClient _httpClient = new();

    private static T[] HandleResponse<T>(HttpResponseMessage response, CancellationToken stoppingToken) where T : class
    {
        response.EnsureSuccessStatusCode();
        var content = response.Content.ReadAsStringAsync(stoppingToken).Result;
        var result = JsonSerializer.Deserialize<BaseListResponse<T>>(content);

        if (result == null)
        {
            throw new("Response is null");
        }

        if (!result.Result)
        {
            throw new(result.Description);
        }

        return result.Data;
    }

    public async Task<ServerStatus[]> GetServersAsync(CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(SERVERS_OPEN_URL, stoppingToken);
        return HandleResponse<ServerStatus>(response, stoppingToken);
    }

    public async Task<Train[]> GetTrainsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TRAINS_URL_PREFIX + serverCode, stoppingToken);
        return HandleResponse<Train>(response, stoppingToken);
    }

    public async Task<Station[]> GetStationsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(STATIONS_URL_PREFIX + serverCode, stoppingToken);
        return HandleResponse<Station>(response, stoppingToken);
    }

    public async Task<(long time, DateTime date)?> GetTimeAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TIME_URL_PREFIX + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        if (long.TryParse(content, out var time)) return (time, response.Headers.Date!.Value.DateTime);

        throw new(content);
    }

    public async Task<int?> GetTimezoneAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TIMEZONE_URL_PREFIX + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        return int.TryParse(content, out var timezone) ? timezone : null;
    }

    public async Task<Timetable[]> GetAllTimetablesAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(TIMETABLE_URL_PREFIX + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        var result = JsonSerializer.Deserialize<Timetable[]>(content);

        if (result == null)
        {
            throw new("Response is null");
        }

        return result;
    }

    public async Task<EdrTimetableTrainEntry[]> GetEdrTimetablesAsync(string serverCode,
        CancellationToken stoppingToken)
    {
        var response = await _httpClient.GetAsync(EDR_TIMETABLE_URL_PREFIX + serverCode, stoppingToken);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        var result = JsonSerializer.Deserialize<EdrTimetableTrainEntry[]>(content);

        if (result == null)
        {
            throw new("Response is null");
        }

        return result;
    }
}