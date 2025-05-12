using System.Text.Json;
using SMOBackend.Models.Steam;

namespace SMOBackend.Services;

public class SteamApiClient(string apiKey)
{
    private const string BASE_URL = "https://api.steampowered.com/";
    private const string GET_USER_STATS_FOR_GAME = "ISteamUserStats/GetUserStatsForGame/v0002/";
    private const string APP_ID = "1422130";

    private readonly HttpClient _httpClient = new();

    public async Task<PlayerStatsResponse?> GetPlayerStats(string steamId)
    {
        var url = BASE_URL + GET_USER_STATS_FOR_GAME + "?appid=" + APP_ID + "&key=" + apiKey + "&steamid=" + steamId;
        var response = await _httpClient.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<PlayerStatsResponse>(content);
    }
}