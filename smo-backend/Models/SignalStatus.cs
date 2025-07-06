using Newtonsoft.Json;
using SMOBackend.Models.Entity;

namespace SMOBackend.Models;

/// <summary>
/// Represents the status of a signal.
/// </summary>
public class SignalStatus : Signal
{
    public SignalStatus()
    {
    }

    public SignalStatus(Signal signal)
    {
        Name = signal.Name;
        Extra = signal.Extra;
        Location = signal.Location;
        Accuracy = signal.Accuracy;
        Type = signal.Type;
        Role = signal.Role;
        PrevRegex = signal.PrevRegex;
        NextRegex = signal.NextRegex;
        PrevFinalized = signal.PrevFinalized;
        NextFinalized = signal.NextFinalized;
        CreatedBy = signal.CreatedBy;

        Trains = null;
        TrainsAhead = null;
        NextSignalWithTrainAhead = null;
        NextSignals = signal.NextSignalConnections.Select(c => new SignalConnection(c.Next, c.VMAX)).ToArray();
        PrevSignals = signal.PrevSignalConnections.Select(c => new SignalConnection(c.Prev, c.VMAX)).ToArray();
    }

    /// <summary>
    /// The trains that are currently at this signal. (their TrainNoLocal)
    /// </summary>
    [JsonProperty(nameof(Trains))]
    public string[]? Trains { get; set; }

    /// <summary>
    /// The trains that are ahead of this signal. (their TrainNoLocal)
    /// </summary>
    [JsonProperty(nameof(TrainsAhead))]
    public string[]? TrainsAhead { get; set; }

    /// <summary>
    /// The next signal that has a train ahead of it. (Name of the signal)
    /// </summary>
    [JsonProperty(nameof(NextSignalWithTrainAhead))]
    public string? NextSignalWithTrainAhead { get; set; }

    /// <summary>
    /// The next signals that are connected to this signal.
    /// </summary>
    [JsonProperty(nameof(NextSignals))]
    public SignalConnection[] NextSignals { get; set; } = [];

    /// <summary>
    /// The previous signals that are connected to this signal.
    /// </summary>
    [JsonProperty(nameof(PrevSignals))]
    public SignalConnection[] PrevSignals { get; set; } = [];

    /// <summary>
    /// Obsolete: Use NextSignals instead.
    /// </summary>
    [JsonIgnore, Obsolete("Use NextSignals instead.")]
    public new ICollection<SignalConnection> NextSignalConnections { get; } = [];

    /// <summary>
    /// Obsolete: Use PrevSignals instead.
    /// </summary>
    [JsonIgnore, Obsolete("Use PrevSignals instead.")]
    public new ICollection<SignalConnection> PrevSignalConnections { get; } = [];

    /// <summary>
    ///     Represents a connection to another signal.
    /// </summary>
    public record SignalConnection(string Name, short? Vmax);

    public class PartialSignalStatus
    {
        public PartialSignalStatus()
        {
        }

        public PartialSignalStatus(SignalStatus signal)
        {
            Name = signal.Name;
            Trains = signal.Trains;
            TrainsAhead = signal.TrainsAhead;
            NextSignalWithTrainAhead = signal.NextSignalWithTrainAhead;
        }

        [JsonProperty(nameof(Name))] public string Name { get; set; }
        [JsonProperty(nameof(Trains))] public string[]? Trains { get; set; }
        [JsonProperty(nameof(TrainsAhead))] public string[]? TrainsAhead { get; set; }

        [JsonProperty(nameof(NextSignalWithTrainAhead))]
        public string? NextSignalWithTrainAhead { get; set; }
    }
}