using System.Text.Json.Serialization;
using MessagePack;

namespace SMOBackend.Models;

[MessagePackObject(keyAsPropertyName: true)]
public class Timetable
{
    [ JsonPropertyName("trainNoLocal")]
    public required string TrainNoLocal { get; set; }
    [ JsonPropertyName("trainNoInternational")]
    public required string TrainNoInternational { get; set; }
    [ JsonPropertyName("trainName")]
    public required string TrainName { get; set; }
    [ JsonPropertyName("startStation")]
    public required string StartStation { get; set; }
    /// <summary>
    /// <example>"00:00:00"</example>
    /// </summary>
    [ JsonPropertyName("startsAt")]
    public required string StartsAt { get; set; }
    /// <summary>
    /// <example>"00:00:00"</example>
    /// </summary>
    [ JsonPropertyName("endStation")]
    public required string EndStation { get; set; }
    [ JsonPropertyName("endsAt")]
    public required string EndsAt { get; set; }
    [ JsonPropertyName("locoType")]
    public required string LocoType { get; set; }
    [ JsonPropertyName("trainLength")]
    public required int TrainLength { get; set; }
    [ JsonPropertyName("trainWeight")]
    public required int TrainWeight { get; set; }
    [ JsonPropertyName("continuesAs")]
    public required string ContinuesAs { get; set; }
    [ JsonPropertyName("timetable")]
    public required TimetableEntry[] TimetableEntries { get; set; }
}