using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

// ReSharper disable InconsistentNaming

namespace SMOBackend.Models;

public class EDRTimetableEntry
{
    [JsonProperty(nameof(IndexOfPoint))] public required int IndexOfPoint { get; set; }

    /// <summary>
    /// Displayed name of the station
    /// </summary>
    [JsonProperty(nameof(NameForPerson))]
    public required string NameForPerson { get; set; }

    /// <summary>
    /// StationID of the station
    /// </summary>
    [JsonProperty(nameof(PointId))]
    public required string PointId { get; set; }

    [JsonProperty(nameof(DisplayedTrainNumber))] public required string DisplayedTrainNumber { get; set; }

    [JsonProperty(nameof(ArrivalTime))] public required DateTime ArrivalTime { get; set; }

    [JsonProperty(nameof(ActualArrivalTime))] public required DateTime? ActualArrivalTime { get; set; }

    [JsonProperty(nameof(DepartureTime))] public required DateTime DepartureTime { get; set; }

    [JsonProperty(nameof(ActualDepartureTime))] public required DateTime? ActualDepartureTime { get; set; }

    /// <summary>
    /// If a stop is entered in the EDR
    /// </summary>
    [JsonProperty(nameof(IsStopped))]
    public required bool IsStopped { get; set; }

    /// <summary>
    /// How long the stop is entered
    /// </summary>
    [JsonProperty(nameof(StopDuration))]
    public required int StopDuration { get; set; }

    /// <summary>
    /// If the train is running
    /// </summary>
    [JsonProperty(nameof(IsActive))]
    public required bool IsActive { get; set; }

    /// <summary>
    /// If the train is confirmed in the EDR
    /// </summary>
    [JsonProperty(nameof(IsConfirmed))]
    public required bool IsConfirmed { get; set; }

    [JsonProperty(nameof(ConfirmedBy))] public required EDRConfirmationType ConfirmedBy { get; set; }

    /// <summary>
    /// Layover if there is a stop
    /// </summary>
    [JsonProperty(nameof(PlannedStop))]
    public required int PlannedStop { get; set; }

    [JsonProperty(nameof(TimetableType))] public required int TimetableType { get; set; }
    [JsonProperty(nameof(StopTypeNumber))] public required EDRStopType StopTypeNumber { get; set; }

    /// <summary>
    /// If the train is driving left track according to plan
    /// </summary>
    [JsonProperty(nameof(LeftTrack))]
    public required bool LeftTrack { get; set; }

    /// <summary>
    /// The line where the station is
    /// </summary>
    [JsonProperty(nameof(Line))]
    public required int Line { get; set; }

    /// <summary>
    /// Platform where the train should stop at (only for passenger stops)
    /// </summary>
    [JsonProperty(nameof(Platform))]
    public required string Platform { get; set; }

    /// <summary>
    /// Track where the train should stop at (only for passenger stops)
    /// </summary>
    [JsonProperty(nameof(Track))]
    public required int? Track { get; set; }

    /// <summary>
    /// Train type
    /// </summary>
    [JsonProperty(nameof(TrainType))]
    public required string TrainType { get; set; }

    /// <summary>
    /// Mileage where the station is
    /// </summary>
    [JsonProperty(nameof(Mileage))]
    public required double Mileage { get; set; }

    /// <summary>
    /// Max speed of the train at this station
    /// </summary>
    [JsonProperty(nameof(MaxSpeed))]
    public required int MaxSpeed { get; set; }
}

[JsonConverter(typeof(StringEnumConverter))]
public enum EDRConfirmationType
{
    NotConfirmed = 0,
    Player = 1,
    NotInUse = 2,
    AutomaticallyConfirmed = 3
}

[JsonConverter(typeof(StringEnumConverter))]
public enum EDRStopType
{
    NoStop = 0,
    PassengerStop = 1, // (PH)
    TechnicalStop = 2 // (PT)
}