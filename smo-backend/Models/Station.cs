using System.Text.Json.Serialization;

namespace SMOBackend.Models;

public class Station
{
    [JsonPropertyName("Name")] public required string Name { get; set; }
    [JsonPropertyName("Prefix")] public required string Prefix { get; set; }
    [JsonPropertyName("DifficultyLevel")] public required byte DifficultyLevel { get; set; }

    // ReSharper disable once StringLiteralTypo
    [JsonPropertyName("Latititude")] public required double Latitude { get; set; }

    [JsonPropertyName("Longitude")] public required double Longitude { get; set; }

    [JsonPropertyName("MainImageURL")] public required string MainImageUrl { get; set; }

    [JsonPropertyName("AdditionalImage1URL")]
    public required string AdditionalImage1Url { get; set; }

    [JsonPropertyName("AdditionalImage2URL")]
    public required string AdditionalImage2Url { get; set; }

    [JsonPropertyName("DispatchedBy")] public required StationDispatcher[] DispatchedBy { get; set; }
    [JsonPropertyName("id")] public required string Id { get; set; }

    public class PartialStation
    {
        public string Id { get; set; }
        public StationDispatcher[] DispatchedBy { get; set; }
        
        public PartialStation()
        {
        }

        public PartialStation(Station station)
        {
            Id = station.Id;
            DispatchedBy = station.DispatchedBy;
        }
    }
}