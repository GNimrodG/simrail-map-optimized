using SMOBackend.Models.Entity;
using SMOBackend.Models.Trains;

namespace SMOBackend.Models;

public class SignalStatus : Signal
{
    public record SignalConnection(string Name, short? Vmax);

    public string[]? Trains { get; set; }
    public string[]? TrainsAhead { get; set; }
    public string? NextSignalWithTrainAhead { get; set; }

    public SignalConnection[] NextSignals { get; set; } = [];

    public SignalConnection[] PrevSignals { get; set; } = [];

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

    public class PartialSignalStatus
    {
        public string Name { get; set; }
        public string[]? Trains { get; set; }
        public string[]? TrainsAhead { get; set; }
        public string? NextSignalWithTrainAhead { get; set; }

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
    }
}