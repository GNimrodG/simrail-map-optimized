using System.Text.Json.Serialization;

namespace SMOBackend.Models;

public class BaseListResponse<T> where T : class
{
    [JsonPropertyName("result")]
    public required bool Result { get; set; }
    
    [JsonPropertyName("data")]
    public required T[] Data { get; set; }
    
    [JsonPropertyName("count")]
    public required int Count { get; set; }
    
    [JsonPropertyName("description")]
    public required string Description { get; set; }
}