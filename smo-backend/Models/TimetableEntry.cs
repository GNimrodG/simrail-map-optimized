using System.Text.Json.Serialization;
using MessagePack;

namespace SMOBackend.Models;

[MessagePackObject(keyAsPropertyName: true)]
public class TimetableEntry
{
    [JsonPropertyName("nameOfPoint")] public required string NameOfPoint { get; set; }

    [JsonPropertyName("nameForPerson")] public required string NameForPerson { get; set; }

    [JsonPropertyName("pointId")] public required string PointId { get; set; }

    [JsonPropertyName("supervisedBy")] public string? SupervisedBy { get; set; }

    // ReSharper disable once StringLiteralTypo
    [JsonPropertyName("radioChanels")] public required string RadioChannels { get; set; }

    [JsonPropertyName("displayedTrainNumber")]
    public required string DisplayedTrainNumber { get; set; }

    [JsonPropertyName("arrivalTime")] public required string? ArrivalTime { get; set; }

    [JsonPropertyName("departureTime")] public required string? DepartureTime { get; set; }

    [JsonPropertyName("stopType")] public required EStopType StopType { get; set; }
    [JsonPropertyName("line")] public required int Line { get; set; }

    [JsonPropertyName("platform")] public required string? Platform { get; set; }

    [JsonPropertyName("track")] public required int? Track { get; set; }

    [JsonPropertyName("trainType")] public required string TrainType { get; set; }

    [JsonPropertyName("mileage")] public required double Mileage { get; set; }

    [JsonPropertyName("maxSpeed")] public required int MaxSpeed { get; set; }

    [JsonPropertyName("stationCategory")] public required EStationCategory? StationCategory { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EStopType
{
    NoStopOver,
    CommercialStop,
    NoncommercialStop
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EStationCategory
{
    A,
    B,
    C,
    D,
    E
}