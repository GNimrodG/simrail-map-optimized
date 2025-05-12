using System.Text.Json.Serialization;

namespace SMOBackend.Models;

public class EdrTimetableTrainEntry
{
    [JsonPropertyName("TrainNoLocal")] public required string TrainNoLocal { get; set; }
    [JsonPropertyName("TrainName")] public required string TrainName { get; set; }
    [JsonPropertyName("StartStation")] public required string StartStation { get; set; }
    [JsonPropertyName("EndStation")] public required string EndStation { get; set; }
    [JsonPropertyName("UsageNotes")] public required string UsageNotes { get; set; }
    [JsonPropertyName("OwnNotes")] public required string OwnNotes { get; set; }
    [JsonPropertyName("IsQualityTracked")] public required bool IsQualityTracked { get; set; }
    [JsonPropertyName("IsOverGauge")] public required bool IsOverGauge { get; set; }

    [JsonPropertyName("IsOtherExceptional")]
    public required bool IsOtherExceptional { get; set; }

    [JsonPropertyName("IsHighRiskCargo")] public required bool IsHighRiskCargo { get; set; }
    [JsonPropertyName("IsDangerousCargo")] public required bool IsDangerousCargo { get; set; }
    [JsonPropertyName("CarrierName")] public required string CarrierName { get; set; }
    [JsonPropertyName("Timetable")] public required EDRTimetableEntry[] Timetable { get; set; }
}