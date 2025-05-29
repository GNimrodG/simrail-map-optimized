using Newtonsoft.Json;
using MessagePack;
using Newtonsoft.Json.Converters;

namespace SMOBackend.Models;

[MessagePackObject(keyAsPropertyName: true)]
public class TimetableEntry
{
    [JsonProperty("nameOfPoint")] public required string NameOfPoint { get; set; }

    [JsonProperty("nameForPerson")] public required string NameForPerson { get; set; }

    [JsonProperty("pointId")] public required string PointId { get; set; }

    [JsonProperty("supervisedBy")] public string? SupervisedBy { get; set; }

    // ReSharper disable once StringLiteralTypo
    [JsonProperty("radioChanels")] public required string RadioChannels { get; set; }

    [JsonProperty("displayedTrainNumber")]
    public required string DisplayedTrainNumber { get; set; }

    [JsonProperty("arrivalTime")] public required string? ArrivalTime { get; set; }

    [JsonProperty("departureTime")] public required string? DepartureTime { get; set; }

    [JsonProperty("stopType")] public required EStopType StopType { get; set; }
    [JsonProperty("line")] public required int Line { get; set; }

    [JsonProperty("platform")] public required string? Platform { get; set; }

    [JsonProperty("track")] public required byte? Track { get; set; }

    [JsonProperty("trainType")] public required string TrainType { get; set; }

    [JsonProperty("mileage")] public required double Mileage { get; set; }

    [JsonProperty("maxSpeed")] public required int MaxSpeed { get; set; }

    [JsonProperty("stationCategory")] public required EStationCategory? StationCategory { get; set; }
}

[JsonConverter(typeof(StringEnumConverter))]
public enum EStopType
{
    NoStopOver,
    CommercialStop,
    NoncommercialStop
}

[JsonConverter(typeof(StringEnumConverter))]
public enum EStationCategory
{
    A,
    B,
    C,
    D,
    E
}