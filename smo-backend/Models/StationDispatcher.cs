using System.Text.Json.Serialization;

namespace SMOBackend.Models;

public class StationDispatcher
{
    [JsonPropertyName("ServerCode")] public required string ServerCode { get; set; }
    [JsonPropertyName("SteamId")] public required string SteamId { get; set; }
}