using Newtonsoft.Json;

namespace SMOBackend.Models;

public class BaseListResponse<T> where T : class
{
    [JsonProperty("result")]
    public required bool Result { get; set; }
    
    [JsonProperty("data")]
    public required T[] Data { get; set; }
    
    [JsonProperty("count")]
    public required int Count { get; set; }
    
    [JsonProperty("description")]
    public required string Description { get; set; }
}