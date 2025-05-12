// ReSharper disable InconsistentNaming

using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using MessagePack;

namespace SMOBackend.Models.Trains;

[MessagePackObject(keyAsPropertyName: true)]
public partial class BaseTrainData
{
    [JsonPropertyName("Velocity")] public required double Velocity { get; set; }
    [JsonPropertyName("SignalInFront")] public string? SignalInFront { get; set; }

    [JsonPropertyName("DistanceToSignalInFront")]
    public required double DistanceToSignalInFront { get; set; }

    [JsonPropertyName("SignalInFrontSpeed")]
    public required short SignalInFrontSpeed { get; set; }

    public string? GetSignalExtra()
    {
        if (string.IsNullOrEmpty(SignalInFront)) return null;

        var parts = SignalInFront.Split('@');

        return parts[1];
    }
}