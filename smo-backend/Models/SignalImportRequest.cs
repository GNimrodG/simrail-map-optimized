using NetTopologySuite.Geometries;
using SMOBackend.Analytics;

namespace SMOBackend.Models;

/// <summary>
/// Signals extracted from the game files (.claude/skills/extract-game-map-data/scripts/extract_signals.py), to create
/// or correct the signals.
/// </summary>
public class SignalImportRequest : PasswordRequest
{
    /// <summary>
    /// The signals. A name can come more than once: the game has a few signals twice (a copy of the station's objects),
    /// the one nearest the signal's known location is used (see <see cref="SignalImportEntry.PickCopy"/>).
    /// </summary>
    public SignalImportEntry[] Signals { get; set; } = [];

    /// <summary>
    /// Signals whose game position replaces their location even when it's far from the location learned from the
    /// trains (the game moved them since).
    /// </summary>
    public string[] Overrule { get; set; } = [];
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

    /// <summary>
    /// The copy of a signal to import: the one nearest its known location (the copy the trains report), or the first
    /// one for a new signal (the extractor lists the copy it trusts most first).
    /// </summary>
    public static SignalImportEntry PickCopy(IReadOnlyList<SignalImportEntry> copies, Point? knownLocation) =>
        knownLocation == null
            ? copies[0]
            : copies.MinBy(c => knownLocation.HaversineDistance(new Point(c.Longitude, c.Latitude) { SRID = 4326 }))!;
}
