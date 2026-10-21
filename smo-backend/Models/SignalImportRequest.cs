namespace SMOBackend.Models;

/// <summary>
/// Signals extracted from the game files (.claude/skills/extract-game-map-data/scripts/extract_signals.py), to create
/// or correct the signals.
/// </summary>
public class SignalImportRequest : PasswordRequest
{
    public SignalImportEntry[] Signals { get; set; } = [];
}

/// <summary>
/// A signal from the game files.
/// </summary>
public class SignalImportEntry
{
    /// <summary>
    /// The signal's name (what trains report in SignalInFront before the "@").
    /// </summary>
    public required string Name { get; set; }

    /// <summary>
    /// The part of SignalInFront after the "@" (the signal's position in the game's coordinates).
    /// </summary>
    public required string Extra { get; set; }

    public required double Longitude { get; set; }

    public required double Latitude { get; set; }

    /// <summary>
    /// The direction of travel the signal applies to, in degrees clockwise from north. Null when the game's object
    /// is a placeholder (its position came from the extra).
    /// </summary>
    public double? Heading { get; set; }
}
