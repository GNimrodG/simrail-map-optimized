using MessagePack;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using SMOBackend.Utils;

namespace SMOBackend.Models;

/// <summary>
/// Represents a timetable entry for a train at a specific point
/// </summary>
[MessagePackObject(keyAsPropertyName: true)]
public class TimetableEntry
{
    /// <summary>
    /// Name of the point/station
    /// </summary>
    [JsonProperty("nameOfPoint")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string NameOfPoint { get; set; }

    /// <summary>
    /// Display name for persons
    /// </summary>
    [JsonProperty("nameForPerson")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string NameForPerson { get; set; }

    /// <summary>
    /// Point identifier
    /// </summary>
    [JsonProperty("pointId")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string PointId { get; set; }

    /// <summary>
    /// Station supervisor information
    /// </summary>
    [JsonProperty("supervisedBy")]
    [JsonConverter(typeof(InterningStringConverter))]
    public string? SupervisedBy { get; set; }

    /// <summary>
    /// Radio channels for the station
    /// </summary>
    // ReSharper disable once StringLiteralTypo
    [JsonProperty("radioChanels")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string RadioChannels { get; set; }

    /// <summary>
    /// Displayed train number
    /// </summary>
    [JsonProperty("displayedTrainNumber")]
    public required string DisplayedTrainNumber { get; set; }

    /// <summary>
    /// Arrival time at this point
    /// </summary>
    [JsonProperty("arrivalTime")]
    public required string? ArrivalTime { get; set; }

    /// <summary>
    /// Departure time from this point
    /// </summary>
    [JsonProperty("departureTime")]
    public required string? DepartureTime { get; set; }

    /// <summary>
    /// Type of stop at this point
    /// </summary>
    [JsonProperty("stopType")] 
    public required EStopType StopType { get; set; }
    
    /// <summary>
    /// Line number
    /// </summary>
    [JsonProperty("line")] 
    public required ushort Line { get; set; }

    /// <summary>
    /// Platform information
    /// </summary>
    [JsonProperty("platform")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string? Platform { get; set; }

    /// <summary>
    /// Track number
    /// </summary>
    [JsonProperty("track")] 
    public required byte? Track { get; set; }

    /// <summary>
    /// Type of train
    /// </summary>
    [JsonProperty("trainType")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string TrainType { get; set; }

    /// <summary>
    /// Mileage at this point
    /// </summary>
    [JsonProperty("mileage")] 
    public required double Mileage { get; set; }

    /// <summary>
    /// Maximum speed at this point
    /// </summary>
    [JsonProperty("maxSpeed")] 
    public required int MaxSpeed { get; set; }

    /// <summary>
    /// Station category
    /// </summary>
    [JsonProperty("stationCategory")] 
    public required EStationCategory? StationCategory { get; set; }
}

/// <summary>
/// Types of stops a train can make at a station
/// </summary>
[JsonConverter(typeof(InterningStringEnumConverter))]
public enum EStopType
{
    /// <summary>
    /// Train passes through without stopping
    /// </summary>
    NoStopOver,
    
    /// <summary>
    /// Commercial passenger stop
    /// </summary>
    CommercialStop,
    
    /// <summary>
    /// Non-commercial stop (technical, operational)
    /// </summary>
    NoncommercialStop
}

/// <summary>
/// Station categories used in railway operations
/// </summary>
[JsonConverter(typeof(InterningStringEnumConverter))]
public enum EStationCategory
{
    /// <summary>
    /// Category A station
    /// </summary>
    A,
    
    /// <summary>
    /// Category B station
    /// </summary>
    B,
    
    /// <summary>
    /// Category C station
    /// </summary>
    C,
    
    /// <summary>
    /// Category D station
    /// </summary>
    D,
    
    /// <summary>
    /// Category E station
    /// </summary>
    E
}