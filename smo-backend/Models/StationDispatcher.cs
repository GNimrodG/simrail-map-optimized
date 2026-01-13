using Newtonsoft.Json;
using SMOBackend.Utils;

namespace SMOBackend.Models;

public class StationDispatcher
{
    [JsonProperty(nameof(ServerCode))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string ServerCode { get; set; }

    [JsonProperty(nameof(SteamId))] public required string SteamId { get; set; }
    
    [JsonProperty(nameof(XboxId))] public required ulong? XboxId { get; set; }
}