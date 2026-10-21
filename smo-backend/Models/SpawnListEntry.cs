using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace SMOBackend.Models;

/// <summary>
///     The state of a train in the spawn list.
/// </summary>
[JsonConverter(typeof(StringEnumConverter))]
public enum SpawnStatus
{
    /// <summary>
    ///     The train is expected to spawn in the future.
    /// </summary>
    Upcoming,

    /// <summary>
    ///     The expected spawn time has passed, but the train hasn't spawned yet.
    /// </summary>
    Overdue,

    /// <summary>
    ///     The train has spawned recently.
    /// </summary>
    Spawned
}

/// <summary>
///     A train that spawns (enters the map) at a border station.
/// </summary>
public class SpawnListEntry
{
    /// <summary>
    ///     The local train number.
    /// </summary>
    public required string TrainNoLocal { get; init; }

    /// <summary>
    ///     The train name (e.g. "ROJ", "EIC").
    /// </summary>
    public required string TrainName { get; init; }

    /// <summary>
    ///     The train type at the border (e.g. "RPJ", "TME").
    /// </summary>
    public required string TrainType { get; init; }

    /// <summary>
    ///     The first station of the train's whole run.
    /// </summary>
    public required string StartStation { get; init; }

    /// <summary>
    ///     The last station of the train's whole run.
    /// </summary>
    public required string EndStation { get; init; }

    /// <summary>
    ///     The border station: the last timetable point before the train spawns (where it comes from), or the first point
    ///     of the train when it spawns at the start of its run.
    /// </summary>
    public required string Border { get; init; }

    /// <summary>
    ///     The first timetable point the train runs to after spawning.
    /// </summary>
    public required string Entry { get; init; }

    /// <summary>
    ///     The scheduled time at the border station, in the server's time ("yyyy-MM-dd HH:mm:ss"), as in the timetable.
    /// </summary>
    public required string ScheduledTime { get; init; }

    /// <summary>
    ///     When the train is expected to spawn (or spawned), in the server's time ("yyyy-MM-dd HH:mm:ss").
    /// </summary>
    public required string ExpectedTime { get; init; }

    /// <summary>
    ///     When the train is expected to spawn (UTC): the scheduled time shifted by how early or late trains usually
    ///     spawn at this border. For spawned trains, when it spawned.
    /// </summary>
    public required DateTime ExpectedAt { get; init; }

    /// <summary>
    ///     Whether the train is upcoming, overdue or has spawned.
    /// </summary>
    public required SpawnStatus Status { get; init; }

    /// <summary>
    ///     The locomotive type from the timetable.
    /// </summary>
    public required string LocoType { get; init; }

    /// <summary>
    ///     The train length from the timetable, in meters.
    /// </summary>
    public required int TrainLength { get; init; }

    /// <summary>
    ///     The train weight from the timetable, in tonnes.
    /// </summary>
    public required int TrainWeight { get; init; }

    /// <summary>
    ///     The vehicles of the train: the live consist of a spawned train, otherwise the consist from the last time the
    ///     train ran on the server. Null when it's unknown.
    /// </summary>
    public required string[]? Consist { get; init; }

    /// <summary>
    ///     Whether <see cref="Consist" /> is from the last time the train ran (the next run may differ).
    /// </summary>
    public required bool ConsistFromLastRun { get; init; }
}
