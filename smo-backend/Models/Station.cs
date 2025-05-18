using Newtonsoft.Json;

namespace SMOBackend.Models;

public class Station
{
    [JsonProperty(nameof(Name))] public required string Name { get; set; }
    [JsonProperty(nameof(Prefix))] public required string Prefix { get; set; }
    [JsonProperty(nameof(DifficultyLevel))] public required byte DifficultyLevel { get; set; }

    // ReSharper disable once StringLiteralTypo
    [JsonProperty("Latititude")] public required double Latitude { get; set; }

    [JsonProperty(nameof(Longitude))] public required double Longitude { get; set; }

    [JsonProperty("MainImageURL")] public required string MainImageUrl { get; set; }

    [JsonProperty("AdditionalImage1URL")]
    public required string AdditionalImage1Url { get; set; }

    [JsonProperty("AdditionalImage2URL")]
    public required string AdditionalImage2Url { get; set; }

    [JsonProperty(nameof(DispatchedBy))] public required StationDispatcher[] DispatchedBy { get; set; }
    [JsonProperty("id")] public required string Id { get; set; }

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