// ReSharper disable InconsistentNaming

using MessagePack;
using Newtonsoft.Json;
using SMOBackend.Utils;

namespace SMOBackend.Models.Trains;

/// <summary>
///     The train data that every train message carries: its speed and the signal ahead.
/// </summary>
[MessagePackObject(keyAsPropertyName: true)]
public class BaseTrainData
{
    /// <summary>
    /// The velocity of the train.
    /// </summary>
    [JsonProperty(nameof(Velocity))]
    public required double Velocity { get; set; }

    /// <summary>
    /// The signal ahead of the train, as "name@extra" (the extra tells the game's copies of a name apart).
    /// </summary>
    [JsonProperty(nameof(SignalInFront))]
    [JsonConverter(typeof(InterningStringConverter))]
    public string? SignalInFront { get; set; }

    /// <summary>
    /// The distance to the signal ahead, in metres.
    /// </summary>
    [JsonProperty(nameof(DistanceToSignalInFront))]
    public required double DistanceToSignalInFront { get; set; }

    /// <summary>
    /// The speed the signal ahead allows, in km/h (above 200: no limit, VMAX).
    /// </summary>
    [JsonProperty(nameof(SignalInFrontSpeed))]
    public required short SignalInFrontSpeed { get; set; }

    /// <summary>
    /// The extra of the signal ahead (after the "@"), null when there's none.
    /// </summary>
    public string? GetSignalExtra()
    {
        if (string.IsNullOrEmpty(SignalInFront)) return null;

        var parts = SignalInFront.Split('@');

        return parts.Length > 1 ? parts[1] : null;
    }
}