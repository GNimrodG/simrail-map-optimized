using System.Text.Json.Serialization;
using MessagePack;

namespace SMOBackend.Models.Trains;

[MessagePackObject(keyAsPropertyName: true)]
public class Train
{
    [JsonPropertyName("TrainNoLocal")] public required string TrainNoLocal { get; set; }
    [JsonPropertyName("TrainName")] public required string TrainName { get; set; }
    [JsonPropertyName("StartStation")] public required string StartStation { get; set; }
    [JsonPropertyName("EndStation")] public required string EndStation { get; set; }
    [JsonPropertyName("Vehicles")] public required string[] Vehicles { get; set; }
    [JsonPropertyName("ServerCode")] public required string ServerCode { get; set; }

    [JsonPropertyName("TrainData")] public required TrainData TrainData { get; set; }

    [JsonPropertyName("RunId")] public required string RunId { get; set; }
    [JsonPropertyName("id")] public required string Id { get; set; }
    [JsonPropertyName("Type")] public required string Type { get; set; }

    /// <summary>
    /// Gets the train ID in the format "TrainNoLocal@ServerCode-Id".
    /// </summary>
    public string GetTrainId() => $"{TrainNoLocal}@{ServerCode}-{Id}";

    /// <inheritdoc />
    public override string ToString() => GetTrainId() +
                                         (!string.IsNullOrEmpty(TrainData.SignalInFront)
                                             ? $" at {TrainData.SignalInFront}"
                                             : string.Empty);
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum TrainType
{
    [JsonPropertyName("user")] User,
    [JsonPropertyName("bot")] Bot
}