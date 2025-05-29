using Newtonsoft.Json;

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
    public byte? Track { get; set; }

    /// <summary>
    /// The index of the timetable entry in the list.
    /// </summary>
    public short Index { get; set; }

    /// <summary>
    /// The previous station in the timetable.
    /// </summary>
    public string? PreviousStation { get; set; }

    /// <summary>
    /// The next station in the timetable.
    /// </summary>
    public string? NextStation { get; set; }

    [JsonIgnore] public string? SupervisedBy { get; set; }

    public SimplifiedTimetableEntry()
    {
    }

    internal SimplifiedTimetableEntry(Timetable timetable, int index)
    {
        var timetableEntry = timetable.TimetableEntries[index];

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

        PreviousStation = timetable.TimetableEntries.ElementAtOrDefault(index - 1)?.NameOfPoint;
        NextStation = timetable.TimetableEntries.ElementAtOrDefault(index + 1)?.NameOfPoint;

        Index = (short)index;
        SupervisedBy = timetableEntry.SupervisedBy;
    }
}