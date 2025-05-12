using System.Text.Json.Serialization;

// ReSharper disable InconsistentNaming

namespace SMOBackend.Models;

public class EDRTimetableEntry
{
    [JsonPropertyName("IndexOfPoint")] public required int IndexOfPoint { get; set; }

    /// <summary>
    /// Displayed name of the station
    /// </summary>
    [JsonPropertyName("NameForPerson")]
    public required string NameForPerson { get; set; }

    /// <summary>
    /// StationID of the station
    /// </summary>
    [JsonPropertyName("PointId")]
    public required string PointId { get; set; }

    [JsonPropertyName("DisplayedTrainNumber")]
    public required string DisplayedTrainNumber { get; set; }

    [JsonPropertyName("ArrivalTime")] public required DateTime ArrivalTime { get; set; }

    [JsonPropertyName("ActualArrivalTime")]
    public required DateTime? ActualArrivalTime { get; set; }

    [JsonPropertyName("DepartureTime")] public required DateTime DepartureTime { get; set; }

    [JsonPropertyName("ActualDepartureTime")]
    public required DateTime? ActualDepartureTime { get; set; }

    /// <summary>
    /// If a stop is entered in the EDR
    /// </summary>
    [JsonPropertyName("IsStopped")]
    public required bool IsStopped { get; set; }

    /// <summary>
    /// How long the stop is entered
    /// </summary>
    [JsonPropertyName("StopDuration")]
    public required int StopDuration { get; set; }

    /// <summary>
    /// If the train is running
    /// </summary>
    [JsonPropertyName("IsActive")]
    public required bool IsActive { get; set; }

    /// <summary>
    /// If the train is confirmed in the EDR
    /// </summary>
    [JsonPropertyName("IsConfirmed")]
    public required bool IsConfirmed { get; set; }

    [JsonPropertyName("ConfirmedBy")] public required EDRConfirmationType ConfirmedBy { get; set; }

    /// <summary>
    /// Layover if there is a stop
    /// </summary>
    [JsonPropertyName("PlannedStop")]
    public required int PlannedStop { get; set; }

    [JsonPropertyName("TimetableType")] public required int TimetableType { get; set; }
    [JsonPropertyName("StopTypeNumber")] public required EDRStopType StopTypeNumber { get; set; }

    /// <summary>
    /// If the train is driving left track according to plan
    /// </summary>
    [JsonPropertyName("LeftTrack")]
    public required bool LeftTrack { get; set; }

    /// <summary>
    /// The line where the station is
    /// </summary>
    [JsonPropertyName("Line")]
    public required int Line { get; set; }

    /// <summary>
    /// Platform where the train should stop at (only for passenger stops)
    /// </summary>
    [JsonPropertyName("Platform")]
    public required string Platform { get; set; }

    /// <summary>
    /// Track where the train should stop at (only for passenger stops)
    /// </summary>
    [JsonPropertyName("Track")]
    public required int? Track { get; set; }

    /// <summary>
    /// Train type
    /// </summary>
    [JsonPropertyName("TrainType")]
    public required string TrainType { get; set; }

    /// <summary>
    /// Mileage where the station is
    /// </summary>
    [JsonPropertyName("Mileage")]
    public required double Mileage { get; set; }

    /// <summary>
    /// Max speed of the train at this station
    /// </summary>
    [JsonPropertyName("MaxSpeed")]
    public required int MaxSpeed { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EDRConfirmationType
{
    NotConfirmed = 0,
    Player = 1,
    NotInUse = 2,
    AutomaticallyConfirmed = 3
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum EDRStopType
{
    NoStop = 0,
    PassengerStop = 1, // (PH)
    TechnicalStop = 2 // (PT)
}