// ReSharper disable InconsistentNaming

using System.Text.Json.Serialization;
using MessagePack;

namespace SMOBackend.Models.Trains;

[MessagePackObject(keyAsPropertyName: true)]
public class BaseTrain
{
    public BaseTrain()
    {
    }

    public BaseTrain(Train train)
    {
        TrainNoLocal = train.TrainNoLocal;
        TrainName = train.TrainName;
        TrainData = train.TrainData;
    }

    [JsonPropertyName("TrainNoLocal")] public string TrainNoLocal { get; set; }
    [JsonPropertyName("TrainName")] public string TrainName { get; set; }
    [JsonPropertyName("TrainData")] public BaseTrainData TrainData { get; set; }
}