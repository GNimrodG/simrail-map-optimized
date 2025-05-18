using Newtonsoft.Json;
using MessagePack;

namespace SMOBackend.Models;

[MessagePackObject(keyAsPropertyName: true)]
public class Timetable
{
    [JsonProperty("trainNoLocal")] public required string TrainNoLocal { get; set; }

    [JsonProperty("trainNoInternational")]
    public required string TrainNoInternational { get; set; }

    [JsonProperty("trainName")] public required string TrainName { get; set; }
    [JsonProperty("startStation")] public required string StartStation { get; set; }

    /// <summary>
    /// <example>"00:00:00"</example>
    /// </summary>
    [JsonProperty("startsAt")]
    public required string StartsAt { get; set; }

    /// <summary>
    /// <example>"00:00:00"</example>
    /// </summary>
    [JsonProperty("endStation")]
    public required string EndStation { get; set; }

    [JsonProperty("endsAt")] public required string EndsAt { get; set; }
    [JsonProperty("locoType")] public required string LocoType { get; set; }
    [JsonProperty("trainLength")] public required int TrainLength { get; set; }
    [JsonProperty("trainWeight")] public required int TrainWeight { get; set; }
    [JsonProperty("continuesAs")] public required string ContinuesAs { get; set; }
    [JsonProperty("timetable")] public required TimetableEntry[] TimetableEntries { get; set; }
}