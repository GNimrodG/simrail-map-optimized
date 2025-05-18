using Newtonsoft.Json;

namespace SMOBackend.Models;

public class StationDispatcher
{
    [JsonProperty(nameof(ServerCode))] public required string ServerCode { get; set; }
    [JsonProperty(nameof(SteamId))] public required string SteamId { get; set; }
}