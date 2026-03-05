using FluentAssertions;
using SMOBackend.Models.Entity;
using SMOBackend.Models.Trains;

namespace SMOBackend.Tests.Models;

/// <summary>
///     Unit tests for <see cref="Signal" /> model methods.
/// </summary>
public class SignalTests
{
    // ──────────────────────────────────────────────
    //  UpdateRole Tests
    // ──────────────────────────────────────────────

    [Theory]
    [InlineData("L1_1", "block")]
    [InlineData("L23_456", "block")]
    [InlineData("L1_1A", "block")]
    [InlineData("L99_99Z", "block")]
    public void UpdateRole_BlockSignal_WithMultiplePrevConnections_SetsBlockEntry(string signalName, string type)
    {
        var signal = new Signal
        {
            Name = signalName,
            Type = type,
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections =
            [
                new() { Prev = "L1_0", Next = signalName },
                new() { Prev = "L1_0A", Next = signalName }
            ],
            NextSignalConnections = [new() { Prev = signalName, Next = "L1_2" }]
        };

        var changed = signal.UpdateRole();

        signal.Role.Should().Be("block-entry");
        changed.Should().BeTrue();
    }

    [Theory]
    [InlineData("L1_1", "block")]
    [InlineData("L23_456A", "block")]
    public void UpdateRole_BlockSignal_WithMultipleNextConnections_SetsBlockExit(string signalName, string type)
    {
        var signal = new Signal
        {
            Name = signalName,
            Type = type,
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "L1_0", Next = signalName }],
            NextSignalConnections =
            [
                new() { Prev = signalName, Next = "L1_2" },
                new() { Prev = signalName, Next = "L1_2A" }
            ]
        };

        var changed = signal.UpdateRole();

        signal.Role.Should().Be("block-exit");
        changed.Should().BeTrue();
    }

    [Fact]
    public void UpdateRole_BlockSignal_ConnectsToPrevNonBlock_SetsBlockEntry()
    {
        var signal = new Signal
        {
            Name = "L1_1",
            Type = "block",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "MainStation_A", Next = "L1_1" }],
            NextSignalConnections = [new() { Prev = "L1_1", Next = "L1_2" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("block-entry");
    }

    [Fact]
    public void UpdateRole_BlockSignal_ConnectsToNextNonBlock_SetsBlockExit()
    {
        var signal = new Signal
        {
            Name = "L1_1",
            Type = "block",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "L1_0", Next = "L1_1" }],
            NextSignalConnections = [new() { Prev = "L1_1", Next = "MainStation_B" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("block-exit");
    }

    [Fact]
    public void UpdateRole_BlockSignal_BothEntryAndExit_SetsSingleBlock()
    {
        var signal = new Signal
        {
            Name = "L1_1",
            Type = "block",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "MainStation_A", Next = "L1_1" }],
            NextSignalConnections = [new() { Prev = "L1_1", Next = "MainStation_B" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("single-block");
    }

    [Fact]
    public void UpdateRole_BlockSignal_SinglePrevAndNextBlock_SetsMiddleBlock()
    {
        var signal = new Signal
        {
            Name = "L1_2",
            Type = "block",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "L1_1", Next = "L1_2" }],
            NextSignalConnections = [new() { Prev = "L1_2", Next = "L1_3" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("middle-block");
    }

    [Fact]
    public void UpdateRole_BlockSignal_NoConnections_SetsRoleToNull()
    {
        var signal = new Signal
        {
            Name = "L1_1",
            Type = "block",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        signal.UpdateRole();

        signal.Role.Should().BeNull();
    }

    [Fact]
    public void UpdateRole_MainSignal_AllPrevAreBlock_SetsEntry()
    {
        var signal = new Signal
        {
            Name = "MainStation_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections =
            [
                new() { Prev = "L1_1", Next = "MainStation_A" },
                new() { Prev = "L2_1", Next = "MainStation_A" }
            ],
            NextSignalConnections = [new() { Prev = "MainStation_A", Next = "MainStation_B" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("entry");
    }

    [Fact]
    public void UpdateRole_MainSignal_AllNextAreBlock_SetsExit()
    {
        var signal = new Signal
        {
            Name = "MainStation_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "MainStation_B", Next = "MainStation_A" }],
            NextSignalConnections =
            [
                new() { Prev = "MainStation_A", Next = "L1_1" },
                new() { Prev = "MainStation_A", Next = "L2_1" }
            ]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("exit");
    }

    [Fact]
    public void UpdateRole_MainSignal_BothEntryAndExit_SetsEntryExit()
    {
        var signal = new Signal
        {
            Name = "MainStation_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "L1_1", Next = "MainStation_A" }],
            NextSignalConnections = [new() { Prev = "MainStation_A", Next = "L2_1" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("entry-exit");
    }

    [Fact]
    public void UpdateRole_MainSignal_AllPrevFromDifferentStation_SetsEntry()
    {
        var signal = new Signal
        {
            Name = "StationA_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections =
            [
                new() { Prev = "StationB_C", Next = "StationA_A" },
                new() { Prev = "StationC_D", Next = "StationA_A" }
            ],
            NextSignalConnections = [new() { Prev = "StationA_A", Next = "StationA_B" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("entry");
    }

    [Fact]
    public void UpdateRole_MainSignal_AllNextToDifferentStation_SetsExit()
    {
        var signal = new Signal
        {
            Name = "StationA_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "StationA_B", Next = "StationA_A" }],
            NextSignalConnections =
            [
                new() { Prev = "StationA_A", Next = "StationB_C" },
                new() { Prev = "StationA_A", Next = "StationC_D" }
            ]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("exit");
    }

    [Fact]
    public void UpdateRole_MainSignal_HasPrevAndNextSameStation_SetsIntermediate()
    {
        var signal = new Signal
        {
            Name = "StationA_B",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [new() { Prev = "StationA_A", Next = "StationA_B" }],
            NextSignalConnections = [new() { Prev = "StationA_B", Next = "StationA_C" }]
        };

        signal.UpdateRole();

        signal.Role.Should().Be("intermediate");
    }

    [Fact]
    public void UpdateRole_MainSignal_NoConnections_SetsRoleToNull()
    {
        var signal = new Signal
        {
            Name = "MainStation_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        signal.UpdateRole();

        signal.Role.Should().BeNull();
    }

    [Fact]
    public void UpdateRole_ThrowsArgumentException_WhenPrevSignalConnectionsIsNull()
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = null!,
            NextSignalConnections = []
        };

        var act = () => signal.UpdateRole();

        act.Should().Throw<ArgumentException>()
            .WithMessage("*PrevSignalConnections*null*");
    }

    [Fact]
    public void UpdateRole_ThrowsArgumentException_WhenNextSignalConnectionsIsNull()
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Type = "main",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = null!
        };

        var act = () => signal.UpdateRole();

        act.Should().Throw<ArgumentException>()
            .WithMessage("*NextSignalConnections*null*");
    }

    [Fact]
    public void UpdateRole_ReturnsFalse_WhenRoleDoesNotChange()
    {
        var signal = new Signal
        {
            Name = "L1_1",
            Type = "block",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            Role = "middle-block",
            PrevSignalConnections = [new() { Prev = "L1_0", Next = "L1_1" }],
            NextSignalConnections = [new() { Prev = "L1_1", Next = "L1_2" }]
        };

        var changed = signal.UpdateRole();

        signal.Role.Should().Be("middle-block");
        changed.Should().BeFalse();
    }

    // ──────────────────────────────────────────────
    //  UpdateType Tests
    // ──────────────────────────────────────────────

    [Theory]
    [InlineData(60)]
    [InlineData(100)]
    public void UpdateType_WithTrainSignalSpeed_SetsMainType(short speed)
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var train = new Train
        {
            TrainNoLocal = "T1",
            TrainName = "T1",
            StartStation = "A",
            EndStation = "B",
            Vehicles = [],
            ServerCode = "en1",
            RunId = "run1",
            Id = "id1",
            Type = "user",
            TrainData = new()
            {
                Velocity = 50,
                SignalInFront = "SIG_A@extra",
                DistanceToSignalInFront = 100,
                SignalInFrontSpeed = speed
            }
        };

        var changed = signal.UpdateType(train);

        signal.Type.Should().Be("main");
        changed.Should().BeTrue();
    }

    [Theory]
    [InlineData("MainStation_A")]
    [InlineData("StationA_B1")]
    [InlineData("Poznań_C")]
    [InlineData("1_Warszawa_D")]
    public void UpdateType_WithMainSignalPattern_SetsMainType(string signalName)
    {
        var signal = new Signal
        {
            Name = signalName,
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var changed = signal.UpdateType(null);

        signal.Type.Should().Be("main");
        changed.Should().BeTrue();
    }

    [Theory]
    [InlineData("L1_1")]
    [InlineData("L23_456")]
    [InlineData("L1_1A")]
    [InlineData("L99_99ZZ")]
    public void UpdateType_WithBlockSignalPattern_SetsBlockType(string signalName)
    {
        var signal = new Signal
        {
            Name = signalName,
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var changed = signal.UpdateType(null);

        signal.Type.Should().Be("block");
        changed.Should().BeTrue();
    }

    [Fact]
    public void UpdateType_WithNoMatchingPattern_SetsTypeToNull()
    {
        var signal = new Signal
        {
            Name = "UNKNOWNSIGNAL", // No underscore, won't match any pattern
            Type = "main", // Start with a type
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var changed = signal.UpdateType(null);

        signal.Type.Should().BeNull();
        changed.Should().BeTrue();
    }

    [Fact]
    public void UpdateType_ReturnsFalse_WhenTypeDoesNotChange()
    {
        var signal = new Signal
        {
            Name = "L1_1",
            Type = "block",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var changed = signal.UpdateType(null);

        signal.Type.Should().Be("block");
        changed.Should().BeFalse();
    }

    [Fact]
    public void UpdateType_ThrowsArgumentException_WhenTrainSignalDoesNotMatchSignalName()
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var train = new Train
        {
            TrainNoLocal = "T1",
            TrainName = "T1",
            StartStation = "A",
            EndStation = "B",
            Vehicles = [],
            ServerCode = "en1",
            RunId = "run1",
            Id = "id1",
            Type = "user",
            TrainData = new()
            {
                Velocity = 50,
                SignalInFront = "SIG_B@extra", // Different signal!
                DistanceToSignalInFront = 100,
                SignalInFrontSpeed = 60
            }
        };

        var act = () => signal.UpdateType(train);

        act.Should().Throw<ArgumentException>()
            .WithMessage("*SignalInFront*does not start with*");
    }

    [Fact]
    public void UpdateType_AllowsNullTrain()
    {
        var signal = new Signal
        {
            Name = "L1_1",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var act = () => signal.UpdateType(null);

        act.Should().NotThrow();
    }

    // ──────────────────────────────────────────────
    //  GetBlockingConnections Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void GetBlockingConnections_ParsesSingleConnection()
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            BlockingConnections = "PREV_A-NEXT_A",
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var connections = signal.GetBlockingConnections();

        connections.Should().HaveCount(1);
        connections[0].Prev.Should().Be("PREV_A");
        connections[0].Next.Should().Be("NEXT_A");
    }

    [Fact]
    public void GetBlockingConnections_ParsesMultipleConnections()
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            BlockingConnections = "PREV_A-NEXT_A,PREV_B-NEXT_B,PREV_C-NEXT_C",
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var connections = signal.GetBlockingConnections();

        connections.Should().HaveCount(3);
        connections[0].Prev.Should().Be("PREV_A");
        connections[0].Next.Should().Be("NEXT_A");
        connections[1].Prev.Should().Be("PREV_B");
        connections[1].Next.Should().Be("NEXT_B");
        connections[2].Prev.Should().Be("PREV_C");
        connections[2].Next.Should().Be("NEXT_C");
    }

    [Fact]
    public void GetBlockingConnections_ReturnsEmpty_WhenBlockingConnectionsIsNull()
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            BlockingConnections = null,
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var connections = signal.GetBlockingConnections();

        connections.Should().BeEmpty();
    }

    [Fact]
    public void GetBlockingConnections_ReturnsEmpty_WhenBlockingConnectionsIsEmpty()
    {
        var signal = new Signal
        {
            Name = "SIG_A",
            Extra = "extra",
            Location = new(0, 0) { SRID = 4326 },
            Accuracy = 10,
            BlockingConnections = "",
            PrevSignalConnections = [],
            NextSignalConnections = []
        };

        var connections = signal.GetBlockingConnections();

        connections.Should().BeEmpty();
    }

    // ──────────────────────────────────────────────
    //  Regex Pattern Tests
    // ──────────────────────────────────────────────

    [Theory]
    [InlineData("L1_1", true)]
    [InlineData("L23_456", true)]
    [InlineData("L1_1A", true)]
    [InlineData("L99_99ZZ", true)]
    [InlineData("L1_1a", false)] // lowercase not allowed
    [InlineData("MainStation_A", false)]
    [InlineData("A1_1", false)] // Must start with L
    [InlineData("L_1", false)] // Missing first digit
    [InlineData("L1_", false)] // Missing second digit
    public void BlockSignalRegex_MatchesCorrectly(string signalName, bool shouldMatch)
    {
        var regex = Signal.BLOCK_SIGNAL_REGEX();
        var matches = regex.IsMatch(signalName);
        matches.Should().Be(shouldMatch);
    }

    [Theory]
    [InlineData("L1_1A", true)]
    [InlineData("L23_456B", true)]
    [InlineData("L1_1AB", false)] // Multiple letters not allowed
    [InlineData("L1_1", false)] // No letter
    [InlineData("L1_1a", false)] // Lowercase not allowed
    public void BlockSignalReverseRegex_MatchesCorrectly(string signalName, bool shouldMatch)
    {
        var regex = Signal.BLOCK_SIGNAL_REVERSE_REGEX();
        var matches = regex.IsMatch(signalName);
        matches.Should().Be(shouldMatch);
    }

    [Theory]
    [InlineData("MainStation_A", true)]
    [InlineData("StationA_B1", true)]
    [InlineData("Poznań_C", true)]
    [InlineData("1_Warszawa_D", true)]
    [InlineData("AB_C", true)]
    [InlineData("A_B", true)] // Two letters before underscore - matches!
    [InlineData("X", false)] // Single letter, no underscore - doesn't match
    [InlineData("L1_1", false)] // Looks like block signal
    [InlineData("_Signal", false)] // Must start with alphanumeric
    public void MainSignalRegex_MatchesCorrectly(string signalName, bool shouldMatch)
    {
        var regex = Signal.MAIN_SIGNAL_REGEX();
        var matches = regex.IsMatch(signalName);
        matches.Should().Be(shouldMatch);
    }
}