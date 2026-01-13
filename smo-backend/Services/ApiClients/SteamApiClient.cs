using System.Net;
using Newtonsoft.Json;
using Prometheus;
using SMOBackend.Models.Steam;
using SMOBackend.Utils;

namespace SMOBackend.Services.ApiClients;

/// <summary>
///     A client for interacting with the Steam API to retrieve player summaries and statistics.
/// </summary>
public class SteamApiClient
{
    private const string BaseUrl = "https://api.steampowered.com/";
    private const string GetPlayerSummariesPath = "ISteamUser/GetPlayerSummaries/v2/";
    private const string GetUserStatsForGamePath = "ISteamUserStats/GetUserStatsForGame/v2/";
    private const string AppId = "1422130"; // SimRail App ID
    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "steam");
    private static readonly string PlayerSummaryCacheFile = Path.Combine(DataDirectory, "player-summaries-cache.bin");
    private static readonly string PlayerStatsCacheFile = Path.Combine(DataDirectory, "player-stats-cache.bin");

    private static readonly Summary CacheHits = Metrics
        .CreateSummary("steam_api_cache_hits", "Number of cache hits (1-minute sliding window)",
            new SummaryConfiguration
            {
                LabelNames = ["cache"],
                MaxAge = TimeSpan.FromMinutes(1),
                AgeBuckets = 5
            });

    private static readonly Summary CacheMisses = Metrics
        .CreateSummary("steam_api_cache_misses", "Number of cache misses (1-minute sliding window)",
            new SummaryConfiguration
            {
                LabelNames = ["cache"],
                MaxAge = TimeSpan.FromMinutes(1),
                AgeBuckets = 5
            });

    private readonly string _apiKey;

    private readonly HttpClient _httpClient = new();

    private readonly TtlCache<string, PlayerStatsResponse> _playerStatsCache =
        new(TimeSpan.FromMinutes(10), "PlayerStatsCache");

    private readonly TtlCache<string, PlayerSummariesResponse> _playerSummariesCache =
        new(TimeSpan.FromHours(3), "PlayerSummariesCache");

    private readonly Lock _statsSaveLock = new();

    private readonly Lock _summariesSaveLock = new();

    /// <summary>
    ///     A client for interacting with the Steam API to retrieve player summaries and statistics.
    /// </summary>
    /// <param name="apiKey">The API key for accessing the Steam API.</param>
    public SteamApiClient(string apiKey)
    {
        _apiKey = apiKey;

        if (string.IsNullOrEmpty(_apiKey))
            return;

        Directory.CreateDirectory(DataDirectory);

        try
        {
            _playerSummariesCache.LoadFromFile(PlayerSummaryCacheFile);
            _playerStatsCache.LoadFromFile(PlayerStatsCacheFile);
        }
        catch (Exception)
        {
            // ignore errors when loading cache files
        }

        _playerSummariesCache.KeyAdded += (_, _) =>
        {
            lock (_summariesSaveLock)
            {
                _playerSummariesCache.SaveToFileAsync(PlayerSummaryCacheFile).NoContext();
            }
        };
        
        _playerStatsCache.KeyAdded += (_, _) =>
        {
            lock (_statsSaveLock)
            {
                _playerStatsCache.SaveToFileAsync(PlayerStatsCacheFile).NoContext();
            }
        };
    }

    /// <summary>
    ///     Indicates whether the Steam API client is available (i.e., has a valid API key).
    /// </summary>
    public bool IsAvailable => !string.IsNullOrEmpty(_apiKey);

    /// <summary>
    ///     Retrieves profile data for a given Steam ID.
    /// </summary>
    public async Task<PlayerSummariesResponse?> GetPlayerSummaries(string steamId)
    {
        lock (_summariesSaveLock)
        {
            if (_playerSummariesCache.TryGetValue(steamId, out var cachedResponse))
            {
                CacheHits.WithLabels("Summaries").Observe(1);
                return cachedResponse;
            }
        }

        CacheMisses.WithLabels("Summaries").Observe(1);

        var url = BaseUrl + GetPlayerSummariesPath + "?key=" + _apiKey + "&steamids=" + steamId;
        var response = await _httpClient.GetAsync(url).NoContext();

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            // Retry after a delay if rate limit is exceeded
            await Task.Delay(1000).NoContext(); // Wait for 1 second before retrying
            response = await _httpClient.GetAsync(url).NoContext();

            if (response.StatusCode == HttpStatusCode.TooManyRequests)
                // Handle rate limiting by throwing an exception or returning null
                throw new HttpRequestException("Rate limit exceeded while fetching player summaries.");
        }

        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var reader = new StreamReader(stream);
        await using var jsonReader = new JsonTextReader(reader);

        var serializer = new JsonSerializer();
        var data = serializer.Deserialize<PlayerSummariesResponse>(jsonReader);

        if (data?.Response.Players == null || data.Response.Players.Length == 0)
            return null;

        lock (_summariesSaveLock)
            _playerSummariesCache.Set(steamId, data);

        return data;
    }

    /// <summary>
    ///     Retrieves player statistics for a given Steam ID for the game with App ID 1422130 (SimRail).
    /// </summary>
    public async Task<PlayerStatsResponse?> GetPlayerStats(string steamId)
    {
        lock (_statsSaveLock)
        {
            if (_playerStatsCache.TryGetValue(steamId, out var cachedResponse))
            {
                CacheHits.WithLabels("Stats").Observe(1);
                return cachedResponse;
            }
        }

        CacheMisses.WithLabels("Stats").Observe(1);

        var url = BaseUrl + GetUserStatsForGamePath + "?appid=" + AppId + "&key=" + _apiKey + "&steamid=" + steamId;
        var response = await _httpClient.GetAsync(url).NoContext();

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            // Retry after a delay if rate limit is exceeded
            await Task.Delay(1000).NoContext(); // Wait for 1 second before retrying
            response = await _httpClient.GetAsync(url).NoContext();
        }

        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var reader = new StreamReader(stream);
        await using var jsonReader = new JsonTextReader(reader);

        var serializer = new JsonSerializer();
        var data = serializer.Deserialize<PlayerStatsResponse>(jsonReader);

        if (data?.PlayerStats == null)
            return null;

        lock (_statsSaveLock)
            _playerStatsCache.Set(steamId, data);

        return data;
    }
}