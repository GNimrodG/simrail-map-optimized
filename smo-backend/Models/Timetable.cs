using Newtonsoft.Json;
using MessagePack;
using SMOBackend.Utils;

namespace SMOBackend.Models;

[MessagePackObject(keyAsPropertyName: true)]
public class Timetable
{
    [JsonProperty("trainNoLocal")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string TrainNoLocal { get; set; }

    [JsonProperty("trainNoInternational")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string TrainNoInternational { get; set; }

    [JsonProperty("trainName")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string TrainName { get; set; }

    [JsonProperty("startStation")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string StartStation { get; set; }

    /// <summary>
    /// <example>"00:00:00"</example>
    /// </summary>
    [JsonProperty("startsAt")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string StartsAt { get; set; }

    /// <summary>
    /// <example>"00:00:00"</example>
    /// </summary>
    [JsonProperty("endStation")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string EndStation { get; set; }

    [JsonProperty("endsAt")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string EndsAt { get; set; }

    [JsonProperty("locoType")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string LocoType { get; set; }

    [JsonProperty("trainLength")] public required int TrainLength { get; set; }
    [JsonProperty("trainWeight")] public required int TrainWeight { get; set; }

    [JsonProperty("continuesAs")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string ContinuesAs { get; set; }

    [JsonProperty("timetable")] public required TimetableEntry[] TimetableEntries { get; set; }
}