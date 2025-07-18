﻿using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.RegularExpressions;
using NetTopologySuite.Geometries;
using Newtonsoft.Json;
using SMOBackend.Models.Trains;

namespace SMOBackend.Models.Entity;

/// <summary>
/// Represents a signal in the railway system.
/// </summary>
[Table("signals")]
public partial class Signal : BaseEntity
{
    /// <summary>
    ///     Gets or sets the unique name identifier of the signal.
    /// </summary>
    /// <remarks>
    ///     This serves as the primary key for the signal entity.
    ///     Maximum length is defined by <see cref="Utils.Utils.SignalNameLength" />.
    /// </remarks>
    [JsonProperty(nameof(Name)), Key, MaxLength(Utils.Utils.SignalNameLength)]
    public string Name { get; set; }

    /// <summary>
    ///     Gets or sets additional information about the signal.
    /// </summary>
    /// <remarks>
    ///     Optional field for storing supplementary signal data.
    ///     Maximum length is 255 characters.
    /// </remarks>
    [JsonProperty(nameof(Extra)), MaxLength(255)]
    public string Extra { get; set; }

    /// <summary>
    ///     Gets or sets the geographic location of the signal.
    /// </summary>
    /// <remarks>
    ///     Stored as a PostGIS Point geometry with SRID 4326 (WGS84).
    /// </remarks>
    [JsonProperty(nameof(Location)), Column(TypeName = "Geometry(Point, 4326)")]
    public Point Location { get; set; }

    /// <summary>
    ///     Gets or sets the accuracy of the signal's location in meters.
    /// </summary>
    /// <remarks>
    ///     Represents the precision of the GPS coordinates used to determine the signal's position.
    /// </remarks>
    [JsonProperty(nameof(Accuracy))]
    public double Accuracy { get; set; }

    /// <summary>
    ///     Gets or sets the type classification of the signal.
    /// </summary>
    /// <remarks>
    ///     Common values include "main", "block", or null for unknown types.
    ///     Maximum length is 10 characters.
    /// </remarks>
    [JsonProperty(nameof(Station)), MaxLength(10)]
    public string? Type { get; set; }

    /// <summary>
    ///     Gets or sets the functional role of the signal within the railway network.
    /// </summary>
    /// <remarks>
    ///     Examples include "entry", "exit", "entry-exit", "block-entry", "block-exit", "single-block", "intermediate",
    ///     "middle-block", or null.
    ///     Maximum length is 20 characters.
    /// </remarks>
    [JsonProperty(nameof(Role)), MaxLength(20)]
    public string? Role { get; set; }

    /// <summary>
    ///     Gets or sets the regular expression pattern for matching previous signal connections.
    /// </summary>
    /// <remarks>
    ///     Used to validate or filter signals that can connect as predecessors to this signal.
    ///     Maximum length is 255 characters.
    /// </remarks>
    [JsonProperty(nameof(PrevRegex)), MaxLength(255)]
    public string? PrevRegex { get; set; }

    /// <summary>
    ///     Gets or sets the regular expression pattern for matching next signal connections.
    /// </summary>
    /// <remarks>
    ///     Used to validate or filter signals that can connect as successors to this signal.
    ///     Maximum length is 255 characters.
    /// </remarks>
    [JsonProperty(nameof(NextRegex)), MaxLength(255)]
    public string? NextRegex { get; set; }

    /// <summary>
    ///     Gets or sets a value indicating whether the previous signal connections are finalized.
    /// </summary>
    /// <remarks>
    ///     When true, indicates that the previous signal connections have been validated and locked.
    ///     Defaults to false.
    /// </remarks>
    [JsonProperty(nameof(PrevFinalized))]
    public bool PrevFinalized { get; set; }

    /// <summary>
    ///     Gets or sets a value indicating whether the next signal connections are finalized.
    /// </summary>
    /// <remarks>
    ///     When true, indicates that the next signal connections have been validated and locked.
    ///     Defaults to false.
    /// </remarks>
    [JsonProperty(nameof(NextFinalized))]
    public bool NextFinalized { get; set; }

    /// <summary>
    ///     Gets or sets the connections that block this signal.
    /// </summary>
    [JsonIgnore]
    [MaxLength(200)]
    public string? BlockingConnections { get; set; }

    /// <summary>
    /// Connections where this signal is the previous one.
    /// </summary>
    /// <remarks>NextSignalConnections *-1 SignalConnection.PrevSignal</remarks>
    [JsonIgnore]
    public ICollection<SignalConnection> NextSignalConnections { get; set; }

    /// <summary>
    /// Connections where this signal is the next one.
    /// </summary>
    /// <remarks>PrevSignalConnections *-1 SignalConnection.NextSignal</remarks>
    [JsonIgnore]
    public ICollection<SignalConnection> PrevSignalConnections { get; set; }

    [GeneratedRegex(@"^L\d+_\d+[A-Z]*$", RegexOptions.Compiled)]
    public static partial Regex BLOCK_SIGNAL_REGEX();

    /// <summary>
    /// Regular expression to match the reverse block signal pattern.
    /// The pattern is a word character followed by one or more digits, an underscore, one or more digits, and an uppercase letter.
    /// 
    /// "L1_1A" matches the pattern.
    /// "L23_456B" matches the pattern.
    /// </summary>
    /// <returns></returns>
    [GeneratedRegex(@"^L\d+_\d+[A-Z]$")]
    public static partial Regex BLOCK_SIGNAL_REVERSE_REGEX();

    [GeneratedRegex(
        @"^(\d+_)?([A-KM-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ][A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]*|[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]{2,})\d*_[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ0-9]+",
        RegexOptions.Compiled)]
    public static partial Regex MAIN_SIGNAL_REGEX();

    /// <summary>
    /// Updates the role of the signal based on its connections and type.
    /// </summary>
    /// <remarks>
    /// This method determines the signal's role by analyzing its connections to other signals:
    /// 
    /// For block signals (Type == "block" or name matches BLOCK_SIGNAL_REGEX):
    /// - "block-entry": Has multiple next connections or connects to a non-block signal next
    /// - "block-exit": Has multiple previous connections or connects to a non-block signal previously
    /// - "single-block": Qualifies as both entry and exit
    /// - null: Doesn't qualify for any role
    /// 
    /// For non-block signals:
    /// - "entry": Every previous signal is a block signal
    /// - "exit": Every next signal is a block signal
    /// - "entry-exit": Satisfies both entry and exit conditions
    /// - null: Doesn't satisfy any role conditions
    /// </remarks>
    /// <returns>True if the role has changed, false otherwise.</returns>
    /// <exception cref="ArgumentException">Thrown when PrevSignalConnections or NextSignalConnections is null.</exception>
    public bool UpdateRole()
    {
        // Validate that connection collections are not null
        if (NextSignalConnections == null)
        {
            throw new ArgumentException(
                $"Cannot run {nameof(UpdateRole)} on a signal where {nameof(NextSignalConnections)} is null!");
        }

        if (PrevSignalConnections == null)
        {
            throw new ArgumentException(
                $"Cannot run {nameof(UpdateRole)} on a signal where {nameof(PrevSignalConnections)} is null!");
        }

        // Store previous role to check if it changed
        var prevRole = Role;

        bool isEntry;
        bool isExit;
        bool isMiddle;

        // Process block signals (by explicit type or name pattern)
        if (Type == "block" || BLOCK_SIGNAL_REGEX().IsMatch(Name))
        {
            // Analyze connections to determine signal role
            var hasMultiplePrevConnections = PrevSignalConnections.Count > 1;
            var hasMultipleNextConnections = NextSignalConnections.Count > 1;

            var connectsToPrevNonBlock = PrevSignalConnections.Count == 1 &&
                                         !BLOCK_SIGNAL_REGEX().IsMatch(PrevSignalConnections.First().Prev);

            var connectsToNextNonBlock = NextSignalConnections.Count == 1 &&
                                         !BLOCK_SIGNAL_REGEX().IsMatch(NextSignalConnections.First().Next);

            // Determine signal characteristics
            isEntry = hasMultiplePrevConnections || connectsToPrevNonBlock;
            isExit = hasMultipleNextConnections || connectsToNextNonBlock;
            isMiddle = !isEntry && !isExit &&
                       PrevSignalConnections.Count == 1 && NextSignalConnections.Count == 1;

            // Set role based on characteristics
            // ReSharper disable once ConvertIfStatementToSwitchStatement
            if (isEntry && isExit)
                Role = "single-block";
            else if (isEntry)
                Role = "block-entry";
            else if (isExit)
                Role = "block-exit";
            else if (isMiddle)
                Role = "middle-block";
            else
                Role = null;

            return prevRole != Role;
        }

        var stationPrefix = MAIN_SIGNAL_REGEX().Match(Name).Groups[1].Value;

        // Process non-block signals
        var hasPrevConnections = PrevSignalConnections.Count > 0;
        var hasNextConnections = NextSignalConnections.Count > 0;

        // Determine signal connection characteristics
        var allNextAreBlockSignals = hasNextConnections &&
                                     NextSignalConnections.All(c => BLOCK_SIGNAL_REGEX().IsMatch(c.Next));

        var allPrevAreBlockSignals = hasPrevConnections &&
                                     PrevSignalConnections.All(c => BLOCK_SIGNAL_REGEX().IsMatch(c.Prev));

        var allPrevFromDifferentStation = hasPrevConnections &&
                                          PrevSignalConnections.All(c => !c.Prev.StartsWith(stationPrefix));

        var allNextToDifferentStation = hasNextConnections &&
                                        NextSignalConnections.All(c => !c.Next.StartsWith(stationPrefix));

        // Determine entry/exit characteristics
        isEntry = allPrevAreBlockSignals || allPrevFromDifferentStation;
        isExit = allNextAreBlockSignals || allNextToDifferentStation;
        isMiddle = !isEntry && !isExit &&
                   hasPrevConnections && hasNextConnections;

        // Set role based on characteristics
        // ReSharper disable once ConvertIfStatementToSwitchStatement
        if (isEntry && isExit)
            Role = "entry-exit";
        else if (isEntry)
            Role = "entry";
        else if (isExit)
            Role = "exit";
        else if (isMiddle)
            Role = "intermediate";
        else
            Role = null;

        return prevRole != Role;
    }

    /// <summary>
    /// Updates the type of the signal based on the train's signal in front or the signal naming pattern.
    /// </summary>
    /// <remarks>
    /// The signal type is determined by the following rules:
    /// - "main": If the train's signal in front speed is 60 or 100 km/h, or the signal name matches MAIN_SIGNAL_REGEX
    /// - "block": If the signal name matches BLOCK_SIGNAL_REGEX 
    /// - null: If none of the above conditions are met
    ///
    /// The validation ensures that if a train with SignalInFront is provided, that SignalInFront value
    /// must start with this signal's name followed by '@' to indicate it's referencing this signal.
    /// </remarks>
    /// <param name="train">The train that's currently in front of this signal; can be null</param>
    /// <returns>True if the type has changed, false otherwise.</returns>
    /// <exception cref="ArgumentException">Thrown when the train's signal in front does not start with the signal's name followed by '@'.</exception>
    public bool UpdateType(Train? train)
    {
        // Validate that if a train with SignalInFront is provided, it must reference this signal
        if (train is { TrainData.SignalInFront: not null } &&
            !train.TrainData.SignalInFront.StartsWith(Name + "@"))
            throw new ArgumentException(
                $"Cannot run {nameof(UpdateType)} on a signal where {nameof(train.TrainData.SignalInFront)} does not start with {Name}!");

        // Store previous type to check if it changed
        var prevType = Type;

        // Rule 1: Signal is a "main" type if:
        // - Train's signal in front has a speed of 60 or 100 km/h, or
        // - Signal name matches the main signal pattern
        if (train?.TrainData.SignalInFrontSpeed is 60 or 100 || MAIN_SIGNAL_REGEX().IsMatch(Name))
        {
            Type = "main";
            return prevType != Type;
        }

        // Rule 2: Signal is a "block" type if its name matches the block signal pattern
        if (BLOCK_SIGNAL_REGEX().IsMatch(Name))
        {
            Type = "block";
            return prevType != Type;
        }

        // Rule 3: Signal type is null if it doesn't match any known type
        Type = null;
        return prevType != Type;
    }

    /// <inheritdoc />
    public override string ToString() =>
        $"{Name} ({Type ?? "unknown"}: {Role ?? "unknown"})) at {Location} ({Accuracy} m)";

    public SignalConnection[] GetBlockingConnections()
    {
        if (string.IsNullOrEmpty(BlockingConnections))
            return [];

        return BlockingConnections.Split(',')
            .Select(c =>
            {
                var parts = c.Split('-');
                return new SignalConnection
                {
                    Prev = parts[0],
                    Next = parts[1]
                };
            }).ToArray();
    }
}