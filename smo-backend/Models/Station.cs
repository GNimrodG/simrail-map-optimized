using Newtonsoft.Json;
using SMOBackend.Utils;

namespace SMOBackend.Models;

public class Station
{
    [JsonProperty(nameof(Name))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string Name { get; set; }

    [JsonProperty(nameof(Prefix))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string Prefix { get; set; }

    [JsonProperty(nameof(DifficultyLevel))]
    public required sbyte DifficultyLevel { get; set; }

    // ReSharper disable once StringLiteralTypo
    [JsonProperty("Latititude")] public required double Latitude { get; set; }

    [JsonProperty(nameof(Longitude))] public required double Longitude { get; set; }

    [JsonProperty("MainImageURL")] public required string? MainImageUrl { get; set; }

    [JsonProperty("AdditionalImage1URL")] public required string? AdditionalImage1Url { get; set; }

    [JsonProperty("AdditionalImage2URL")] public required string? AdditionalImage2Url { get; set; }

    [JsonProperty(nameof(DispatchedBy))] public StationDispatcher[] DispatchedBy { get; set; } = [];

    [JsonProperty("id")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string Id { get; set; }

    [JsonProperty(nameof(PointId))]
    [JsonConverter(typeof(InterningStringConverter))]
    public string? PointId { get; set; }

    [JsonProperty(nameof(RemoteControlled))]
    [JsonConverter(typeof(InterningStringConverter))]
    public string? RemoteControlled { get; set; }
    
    [JsonProperty(nameof(SubStations))]
    [JsonConverter(typeof(InterningStringArrayConverter))]
    public string[]? SubStations { get; set; } = [];
    
    [JsonProperty(nameof(IgnoredStations))]
    [JsonConverter(typeof(InterningStringArrayConverter))]
    public string[]? IgnoredStations { get; set; } = [];

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