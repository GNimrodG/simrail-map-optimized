using System.Net;
using Newtonsoft.Json;
using Prometheus;
using SMOBackend.Models;
using SMOBackend.Utils;

namespace SMOBackend.Services.ApiClients;

/// <summary>
///  A client for interacting with the OpenXBL API to retrieve XBOX player information.
/// </summary>
public class XblIoApiClient
{
    private const string BaseUrl = "https://xbl.io/api/v2/";
    private const string GetPlayerAccountPath = "account/";

    private static readonly string DataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "xbox");
    private static readonly string PlayerDataCacheFile = Path.Combine(DataDirectory, "player-data-cache.bin");

    private static readonly Summary CacheHits = Metrics
        .CreateSummary("xbox_api_cache_hits", "Number of cache hits (1-minute sliding window)",
            new SummaryConfiguration
            {
                LabelNames = ["cache"],
                MaxAge = TimeSpan.FromMinutes(1),
                AgeBuckets = 5
            });

    private static readonly Summary CacheMisses = Metrics
        .CreateSummary("xbox_api_cache_misses", "Number of cache misses (1-minute sliding window)",
            new SummaryConfiguration
            {
                LabelNames = ["cache"],
                MaxAge = TimeSpan.FromMinutes(1),
                AgeBuckets = 5
            });

    private readonly string _apiKey;

    private readonly HttpClient _httpClient = new();

    private readonly TtlCache<ulong, XboxProfileData> _playerDataCache =
        new(TimeSpan.FromHours(3), "PlayerDataCache");

    private readonly Lock _dataSaveLock = new();

    /// <param name="apiKey">OpenXBL api key</param>
    public XblIoApiClient(string apiKey)
    {
        _apiKey = apiKey;

        if (string.IsNullOrEmpty(_apiKey))
            return;

        _httpClient.DefaultRequestHeaders.Add("x-authorization", apiKey);

        Directory.CreateDirectory(DataDirectory);

        try
        {
            _playerDataCache.LoadFromFile(PlayerDataCacheFile);
        }
        catch (Exception)
        {
            // ignore errors when loading cache files
        }

        _playerDataCache.KeyAdded += (_, _) =>
        {
            lock (_dataSaveLock)
            {
                _playerDataCache.SaveToFileAsync(PlayerDataCacheFile).NoContext();
            }
        };
    }

    /// <summary>
    ///  
    /// </summary>
    public bool IsAvailable => !string.IsNullOrEmpty(_apiKey);

    /// <summary>
    ///    Gets the basic profile data of the Xbox ID (XUID)
    /// </summary>
    /// <param name="xboxId"></param>
    /// <returns></returns>
    public async Task<XboxProfileData?> GetPlayerProfileData(ulong xboxId)
    {
        lock (_dataSaveLock)
        {
            if (_playerDataCache.TryGetValue(xboxId, out var cachedResponse))
            {
                CacheHits.WithLabels("Data").Observe(1);
                return cachedResponse;
            }
        }

        CacheMisses.WithLabels("Data").Observe(1);

        var url = BaseUrl + GetPlayerAccountPath + xboxId;
        var response = await _httpClient.GetAsync(url);

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            // Return null but don't cache it
            return null;
        }

        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync();
        using var reader = new StreamReader(stream);
        await using var jsonReader = new JsonTextReader(reader);

        var serializer = new JsonSerializer();
        var data = serializer.Deserialize<AccountResponse>(jsonReader);

        if (data?.Users is not { Count: 1 })
            return null;

        var gamertag = data.Users.First().GetSetting("Gamertag");
        var profilePic = data.Users.First().GetSetting("GameDisplayPicRaw");

        if (string.IsNullOrEmpty(gamertag)) return null;

        var profileData = new XboxProfileData()
        {
            PersonaName = gamertag,
            Avatar = profilePic,
        };

        lock (_dataSaveLock)
            _playerDataCache.Add(xboxId, profileData);

        return profileData;
    }


    private class AccountResponse
    {
        [JsonProperty("profileUsers")] public List<ProfileUser> Users { get; set; }
    }

    private class ProfileUser
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("hostId")] public string HostId { get; set; }

        [JsonProperty("settings")] public List<ProfileSetting> Settings { get; set; }

        public string? GetSetting(string setting) => Settings.Find(x => x.Id == setting)?.Value;
    }

    private class ProfileSetting
    {
        [JsonProperty("id")] public string Id { get; set; }
        [JsonProperty("value")] public string Value { get; set; }
    }
}