using Newtonsoft.Json;
using SMOBackend.Utils;

namespace SMOBackend.Models;

/// <summary>
/// Represents a simplified timetable entry.
/// </summary>
public readonly struct SimplifiedTimetableEntry
{
    /// <summary>
    /// The name of the station.
    /// </summary>
    public string StationName { get; }

    /// <summary>
    /// The category of the station.
    /// </summary>
    public EStationCategory? StationCategory { get; }

    /// <summary>
    /// The local train number.
    /// </summary>
    public string TrainNoLocal { get; }

    /// <summary>
    /// The type of the train. E.g. "MOJ", "MPE", etc.
    /// </summary>
    public TrainTypeCode TrainType { get; }

    /// <summary>
    /// The time of arrival at the station.
    /// </summary>
    public string? ArrivalTime { get; }

    /// <summary>
    /// The time of departure from the station.
    /// </summary>
    public string? DepartureTime { get; }

    /// <summary>
    /// The type of stop at the station.
    /// </summary>
    public EStopType StopType { get; }

    /// <summary>
    /// The line number of the train.
    /// </summary>
    public ushort Line { get; }

    /// <summary>
    /// The platform number at the station.
    /// </summary>
    public string? Platform { get; }

    /// <summary>
    /// The track number at the station.
    /// </summary>
    public byte? Track { get; }

    /// <summary>
    /// The index of the timetable entry in the list.
    /// </summary>
    public short Index { get; }

    /// <summary>
    /// The previous station in the timetable.
    /// </summary>
    public string? PreviousStation { get; }

    /// <summary>
    /// The next station in the timetable.
    /// </summary>
    public string? NextStation { get; }

    [JsonIgnore] public string? SupervisedBy { get; }

    internal SimplifiedTimetableEntry(Timetable timetable, int index)
    {
        var timetableEntry = timetable.TimetableEntries[index];

        StationName = string.Intern(timetableEntry.NameOfPoint);
        StationCategory = timetableEntry.StationCategory;

        TrainNoLocal = string.Intern(timetableEntry.DisplayedTrainNumber);
        TrainType = new(timetableEntry.TrainType);

        ArrivalTime = timetableEntry.ArrivalTime == timetableEntry.DepartureTime ? null : timetableEntry.ArrivalTime;
        DepartureTime = timetableEntry.DepartureTime;
        StopType = timetableEntry.StopType;

        Line = timetableEntry.Line;
        Platform = timetableEntry.Platform != null ? string.Intern(timetableEntry.Platform) : null;
        Track = timetableEntry.Track;

        var prevStation = timetable.TimetableEntries.ElementAtOrDefault(index - 1);
        PreviousStation = prevStation != null ? string.Intern(prevStation.NameOfPoint) : null;

        var nextStation = timetable.TimetableEntries.ElementAtOrDefault(index + 1);
        NextStation = nextStation != null ? string.Intern(nextStation.NameOfPoint) : null;

        Index = (short)index;
        SupervisedBy = timetableEntry.SupervisedBy != null ? string.Intern(timetableEntry.SupervisedBy) : null;
    }

    /// <inheritdoc />
    public override string ToString()
    {
        return $"{TrainNoLocal} ({TrainType}) at {StationName} " +
               $"({ArrivalTime ?? "N/A"} - {DepartureTime ?? "N/A"}) " +
               $"[Line: {Line}, Platform: {Platform ?? "N/A"}, Track: {Track?.ToString() ?? "N/A"}] " +
               $"[Stop Type: {StopType}, Category: {StationCategory?.ToString() ?? "N/A"}] " +
               $"[Index: {Index}, Previous: {PreviousStation ?? "N/A"}, Next: {NextStation ?? "N/A"}]";
    }

    /// <summary>
    /// Represents a train type code, which is a 3-character string.
    /// </summary>
    [JsonConverter(typeof(StdUtils.TrainTypeCodeConverter))]
    public readonly struct TrainTypeCode : IEquatable<TrainTypeCode>
    {
        private readonly char _c1;
        private readonly char _c2;
        private readonly char _c3;

        /// <summary>
        /// Initializes a new instance of the <see cref="TrainTypeCode"/> struct with a 3-character code.
        /// </summary>
        /// <param name="code">The 3-character train type code.</param>
        /// <exception cref="ArgumentException">Thrown if the code is not exactly 3 characters long.</exception>
        public TrainTypeCode(string code)
        {
            if (code is not { Length: 3 })
                throw new ArgumentException("Code must be 3 characters long.", nameof(code));

            _c1 = code[0];
            _c2 = code[1];
            _c3 = code[2];
        }

        public override string ToString() => $"{_c1}{_c2}{_c3}";

        public override bool Equals(object? obj) => obj is TrainTypeCode other && Equals(other);

        public bool Equals(TrainTypeCode other) => _c1 == other._c1 && _c2 == other._c2 && _c3 == other._c3;

        public override int GetHashCode() => HashCode.Combine(_c1, _c2, _c3);

        public static bool operator ==(TrainTypeCode left, TrainTypeCode right) => left.Equals(right);

        public static bool operator !=(TrainTypeCode left, TrainTypeCode right) => !(left == right);
    }
}