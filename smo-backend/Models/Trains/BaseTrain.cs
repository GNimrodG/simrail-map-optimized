// ReSharper disable InconsistentNaming

using Newtonsoft.Json;
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

    [JsonProperty(nameof(TrainNoLocal))] public string TrainNoLocal { get; set; }
    [JsonProperty(nameof(TrainName))] public string TrainName { get; set; }
    [JsonProperty(nameof(TrainData))] public BaseTrainData TrainData { get; set; }
}