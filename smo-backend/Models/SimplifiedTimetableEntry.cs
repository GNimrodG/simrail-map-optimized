using System.Text.Json.Serialization;

namespace SMOBackend.Models;

/// <summary>
/// Represents a simplified timetable entry.
/// </summary>
public class SimplifiedTimetableEntry
{
    /// <summary>
    /// The name of the station.
    /// </summary>
    public string StationName { get; set; }

    /// <summary>
    /// The category of the station.
    /// </summary>
    public EStationCategory? StationCategory { get; set; }

    /// <summary>
    /// The local train number.
    /// </summary>
    public string TrainNoLocal { get; set; }

    /// <summary>
    /// The type of the train. E.g. "MOJ", "MPE", etc.
    /// </summary>
    public string TrainType { get; set; }

    /// <summary>
    /// The time of arrival at the station.
    /// </summary>
    public string? ArrivalTime { get; set; }

    /// <summary>
    /// The time of departure from the station.
    /// </summary>
    public string? DepartureTime { get; set; }

    /// <summary>
    /// The type of stop at the station.
    /// </summary>
    public EStopType StopType { get; set; }

    /// <summary>
    /// The line number of the train.
    /// </summary>
    public int Line { get; set; }

    /// <summary>
    /// The platform number at the station.
    /// </summary>
    public string? Platform { get; set; }

    /// <summary>
    /// The track number at the station.
    /// </summary>
    public int? Track { get; set; }

    /// <summary>
    /// The index of the timetable entry in the list.
    /// </summary>
    public int Index { get; set; }

    [JsonIgnore] public string? SupervisedBy { get; set; }

    public SimplifiedTimetableEntry()
    {
    }

    internal SimplifiedTimetableEntry(TimetableEntry timetableEntry, int index)
    {
        StationName = timetableEntry.NameOfPoint;
        StationCategory = timetableEntry.StationCategory;

        TrainNoLocal = timetableEntry.DisplayedTrainNumber;
        TrainType = timetableEntry.TrainType;

        ArrivalTime = timetableEntry.ArrivalTime == timetableEntry.DepartureTime ? null : timetableEntry.ArrivalTime;
        DepartureTime = timetableEntry.DepartureTime;
        StopType = timetableEntry.StopType;

        Line = timetableEntry.Line;
        Platform = timetableEntry.Platform;
        Track = timetableEntry.Track;

        Index = index;
        SupervisedBy = timetableEntry.SupervisedBy;
    }
}