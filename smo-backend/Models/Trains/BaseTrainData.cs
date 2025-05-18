// ReSharper disable InconsistentNaming

using Newtonsoft.Json;
using MessagePack;

namespace SMOBackend.Models.Trains;

[MessagePackObject(keyAsPropertyName: true)]
public class BaseTrainData
{
    /// <summary>
    /// The velocity of the train.
    /// </summary>
    [JsonProperty(nameof(Velocity))] public required double Velocity { get; set; }
    [JsonProperty(nameof(SignalInFront))] public string? SignalInFront { get; set; }

    [JsonProperty(nameof(DistanceToSignalInFront))]
    public required double DistanceToSignalInFront { get; set; }

    [JsonProperty(nameof(SignalInFrontSpeed))]
    public required short SignalInFrontSpeed { get; set; }

    public string? GetSignalExtra()
    {
        if (string.IsNullOrEmpty(SignalInFront)) return null;

        var parts = SignalInFront.Split('@');

        return parts[1];
    }
}