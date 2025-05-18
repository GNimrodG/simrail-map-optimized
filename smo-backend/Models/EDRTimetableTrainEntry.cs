using Newtonsoft.Json;

namespace SMOBackend.Models;

public class EdrTimetableTrainEntry
{
    [JsonProperty(nameof(TrainNoLocal))] public required string TrainNoLocal { get; set; }
    [JsonProperty(nameof(TrainName))] public required string TrainName { get; set; }
    [JsonProperty(nameof(StartStation))] public required string StartStation { get; set; }
    [JsonProperty(nameof(EndStation))] public required string EndStation { get; set; }
    [JsonProperty(nameof(UsageNotes))] public required string UsageNotes { get; set; }
    [JsonProperty(nameof(OwnNotes))] public required string OwnNotes { get; set; }
    [JsonProperty(nameof(IsQualityTracked))] public required bool IsQualityTracked { get; set; }
    [JsonProperty(nameof(IsOverGauge))] public required bool IsOverGauge { get; set; }

    [JsonProperty(nameof(IsOtherExceptional))]
    public required bool IsOtherExceptional { get; set; }

    [JsonProperty(nameof(IsHighRiskCargo))] public required bool IsHighRiskCargo { get; set; }
    [JsonProperty(nameof(IsDangerousCargo))] public required bool IsDangerousCargo { get; set; }
    [JsonProperty(nameof(CarrierName))] public required string CarrierName { get; set; }
    [JsonProperty(nameof(Timetable))] public required EDRTimetableEntry[] Timetable { get; set; }
}