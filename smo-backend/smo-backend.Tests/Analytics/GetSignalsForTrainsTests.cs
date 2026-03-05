using System.Reflection;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using SMOBackend.Analytics;
using SMOBackend.Models;
using SMOBackend.Models.Trains;
using SMOBackend.Utils;

namespace SMOBackend.Tests.Analytics;

/// <summary>
///     Unit tests for <see cref="SignalAnalyzerService.GetSignalsForTrains" />.
/// </summary>
public class GetSignalsForTrainsTests
{
    private readonly Mock<ILogger<SignalAnalyzerService>> _loggerMock = new();
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock = new();

    // ──────────────────────────────────────────────
    //  Helpers
    // ──────────────────────────────────────────────

    private TestableSignalAnalyzerService CreateService(SignalStatus[]? signals = null)
    {
        return new(
            _loggerMock.Object,
            _scopeFactoryMock.Object,
            signals ?? []);
    }

    private static Train MakeTrain(
        string trainNoLocal,
        string serverCode,
        string? signalInFront = null,
        double distanceToSignal = 50,
        short signalSpeed = 40,
        double velocity = 60,
        string? id = null)
    {
        return new()
        {
            TrainNoLocal = trainNoLocal,
            TrainName = trainNoLocal,
            StartStation = "A",
            EndStation = "B",
            Vehicles = [],
            ServerCode = serverCode,
            RunId = "run1",
            Id = id ?? Guid.NewGuid().ToString(),
            Type = "user",
            TrainData = new()
            {
                Velocity = velocity,
                SignalInFront = signalInFront,
                DistanceToSignalInFront = distanceToSignal,
                SignalInFrontSpeed = signalSpeed,
                Latitude = 51.0,
                Longitude = 19.0
            }
        };
    }

    private static SignalStatus MakeSignal(
        string name,
        string? type = null,
        bool nextFinalized = false,
        SignalStatus.SignalConnection[]? nextSignals = null,
        SignalStatus.SignalConnection[]? prevSignals = null,
        string? blockingConnections = null)
    {
        return new()
        {
            Name = name,
            Extra = "extra",
            Location = new(19.0, 51.0) { SRID = 4326 },
            Accuracy = 10,
            Type = type,
            Role = null,
            PrevFinalized = false,
            NextFinalized = nextFinalized,
            PrevRegex = null,
            NextRegex = null,
            NextSignals = nextSignals ?? [],
            PrevSignals = prevSignals ?? [],
            BlockingConnections = blockingConnections
        };
    }

    // ──────────────────────────────────────────────
    //  Tests
    // ──────────────────────────────────────────────

    [Fact]
    public async Task ThrowsArgumentNullException_WhenTrainsIsNull()
    {
        var sut = CreateService();

        await sut.Invoking(s => s.GetSignalsForTrains(null!))
            .Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task ReturnsSignals_WhenTrainsArrayIsEmpty()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A"),
            MakeSignal("SIG_B")
        };

        var sut = CreateService(signals);

        var result = await sut.GetSignalsForTrains([]);

        result.Should().HaveCount(2);
        result.Select(s => s.Name).Should().BeEquivalentTo("SIG_A", "SIG_B");
    }

    [Fact]
    public async Task SetsTrainsOnSignal_WhenTrainIsAtSignal()
    {
        var signals = new[] { MakeSignal("SIG_A") };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_A@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var signal = result.Single(s => s.Name == "SIG_A");
        signal.Trains.Should().BeEquivalentTo("T1");
    }

    [Fact]
    public async Task SetsMultipleTrainsOnSignal_WhenMultipleTrainsAtSameSignal()
    {
        var signals = new[] { MakeSignal("SIG_A") };
        var trains = new[]
        {
            MakeTrain("T1", "en1", "SIG_A@extra", 30),
            MakeTrain("T2", "en1", "SIG_A@extra")
        };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var signal = result.Single(s => s.Name == "SIG_A");
        signal.Trains.Should().BeEquivalentTo("T1", "T2");
    }

    [Fact]
    public async Task TrainsIsNull_WhenNoTrainAtSignal()
    {
        var signals = new[] { MakeSignal("SIG_A") };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_B@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var signal = result.Single(s => s.Name == "SIG_A");
        signal.Trains.Should().BeNull();
    }

    [Fact]
    public async Task SetsTrainsAhead_ForBlockSignalWithOneNextSignal()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_B@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeEquivalentTo("T1");
    }

    [Fact]
    public async Task SetsTrainsAhead_ForMainFinalizedSignalWithOneNextSignal()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "main", true,
                [new("SIG_B", null)]),
            MakeSignal("SIG_B")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_B@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeEquivalentTo("T1");
    }

    [Fact]
    public async Task TrainsAheadIsNull_ForBlockSignalWithMultipleNextSignals()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals:
                [
                    new("SIG_B", null),
                    new("SIG_C", null)
                ]),
            MakeSignal("SIG_B"),
            MakeSignal("SIG_C")
        };
        var trains = new[]
        {
            MakeTrain("T1", "en1", "SIG_B@extra"),
            MakeTrain("T2", "en1", "SIG_C@extra")
        };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeNull();
    }

    [Fact]
    public async Task SetsTrainsAhead_ForMainFinalizedWithMultipleNextSignals_AllHaveTrains()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "main", true,
            [
                new("SIG_B", null),
                new("SIG_C", null)
            ]),
            MakeSignal("SIG_B"),
            MakeSignal("SIG_C")
        };
        var trains = new[]
        {
            MakeTrain("T1", "en1", "SIG_B@extra"),
            MakeTrain("T2", "en1", "SIG_C@extra")
        };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeEquivalentTo("T1", "T2");
    }

    [Fact]
    public async Task TrainsAheadIsNull_ForMainFinalizedWithMultipleNextSignals_NotAllHaveTrains()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "main", true,
            [
                new("SIG_B", null),
                new("SIG_C", null)
            ]),
            MakeSignal("SIG_B"),
            MakeSignal("SIG_C")
        };
        // Only T1 at SIG_B, no train at SIG_C
        var trains = new[] { MakeTrain("T1", "en1", "SIG_B@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeNull();
    }

    [Fact]
    public async Task TrainsAheadIsNull_WhenNextSignalHasNoTrain()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_C@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeNull();
    }

    [Fact]
    public async Task SetsNextSignalWithTrainAhead_WhenTrainTwoSignalsAhead()
    {
        // SIG_A (block,1 next) -> SIG_B (block,1 next) -> SIG_C (has train)
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B", "block",
                nextSignals: [new("SIG_C", null)]),
            MakeSignal("SIG_C")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_C@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.NextSignalWithTrainAhead.Should().Be("SIG_B");
    }

    [Fact]
    public async Task NextSignalWithTrainAheadIsNull_WhenNoTrainTwoSignalsAhead()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B", "block",
                nextSignals: [new("SIG_C", null)]),
            MakeSignal("SIG_C")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_D@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.NextSignalWithTrainAhead.Should().BeNull();
    }

    [Fact]
    public async Task DoesNotSetNextSignalWithTrainAhead_WhenNextSignalIsNotSingleChainCandidate()
    {
        // SIG_A (block,1 next) -> SIG_B (main, NOT finalized, 1 next) -> SIG_C
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B", "main", false,
                [new("SIG_C", null)]),
            MakeSignal("SIG_C")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_C@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.NextSignalWithTrainAhead.Should().BeNull();
    }

    [Fact]
    public async Task TrainWithNoSignal_IsIgnoredInSignalsIndex()
    {
        var signals = new[] { MakeSignal("SIG_A") };
        var trains = new[] { MakeTrain("T1", "en1") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var signal = result.Single(s => s.Name == "SIG_A");
        signal.Trains.Should().BeNull();
    }

    [Fact]
    public async Task TrainWithEmptySignal_IsIgnoredInSignalsIndex()
    {
        var signals = new[] { MakeSignal("SIG_A") };
        var trains = new[] { MakeTrain("T1", "en1", "") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var signal = result.Single(s => s.Name == "SIG_A");
        signal.Trains.Should().BeNull();
    }

    [Fact]
    public async Task MainNotFinalized_WithOneNextSignal_DoesNotSetTrainsAhead()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "main", false,
                [new("SIG_B", null)]),
            MakeSignal("SIG_B")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_B@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeNull();
    }

    [Fact]
    public async Task SignalWithNoType_DoesNotSetTrainsAhead()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_B@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeNull();
    }

    [Fact]
    public async Task BlockSignalWithNoNextSignals_DoesNotSetTrainsAhead()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A", "block", nextSignals: []),
            MakeSignal("SIG_B")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_B@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeNull();
    }

    [Fact]
    public async Task ReturnsAllSignals_EvenWhenNoTrainsMatchThem()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A"),
            MakeSignal("SIG_B"),
            MakeSignal("SIG_C")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_X@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        result.Should().HaveCount(3);
        result.Should().AllSatisfy(s => s.Trains.Should().BeNull());
    }

    [Fact]
    public async Task TrainsAreOrderedByDistance_InSignalTrainsProperty()
    {
        var signals = new[] { MakeSignal("SIG_A") };
        var trains = new[]
        {
            MakeTrain("T_FAR", "en1", "SIG_A@extra", 100),
            MakeTrain("T_NEAR", "en1", "SIG_A@extra", 10),
            MakeTrain("T_MID", "en1", "SIG_A@extra")
        };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var signal = result.Single(s => s.Name == "SIG_A");
        signal.Trains.Should().Equal("T_NEAR", "T_MID", "T_FAR");
    }

    [Fact]
    public async Task BlockingConnections_AddsTrainsToTrainsAhead()
    {
        // SIG_A has blocking connection BLOCK_PREV->BLOCK_NEXT.
        // Train T2 is at BLOCK_NEXT and passed BLOCK_PREV.
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)],
                blockingConnections: "BLOCK_PREV-BLOCK_NEXT"),
            MakeSignal("SIG_B"),
            MakeSignal("BLOCK_NEXT"),
            MakeSignal("BLOCK_PREV")
        };

        var trainT2 = MakeTrain("T2", "en1", "BLOCK_NEXT@extra", id: "id2");
        var trains = new[] { trainT2 };

        var sut = CreateService(signals);
        sut.SetPassedSignalCache(trainT2.GetTrainId(), "BLOCK_PREV");

        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().Contain("T2");
    }

    [Fact]
    public async Task EarlierSignalCache_SetsTrainsAhead()
    {
        var signals = new[]
        {
            MakeSignal("SIG_A"),
            MakeSignal("SIG_B")
        };

        var trainT1 = MakeTrain("T1", "en1", "SIG_B@extra", id: "id1");
        var trains = new[] { trainT1 };

        var sut = CreateService(signals);
        sut.SetLastSignalCache(trainT1.GetTrainId(), "SIG_A");

        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeEquivalentTo("T1");
    }

    [Fact]
    public async Task EarlierSignalCache_TakesPrecedence_OverNextSignalLookup()
    {
        // SIG_A has one next signal SIG_B with a train, but also has an earlier signal cache hit
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B")
        };

        var trainT1 = MakeTrain("T1", "en1", "SIG_B@extra", id: "id1");
        var trainT2 = MakeTrain("T2", "en1", "SIG_C@extra", id: "id2");
        var trains = new[] { trainT1, trainT2 };

        var sut = CreateService(signals);
        sut.SetLastSignalCache(trainT2.GetTrainId(), "SIG_A");

        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        // Earlier signal cache takes precedence (hits the `continue`)
        sigA.TrainsAhead.Should().BeEquivalentTo("T2");
    }

    [Fact]
    public async Task TrainsAheadFromEarlierSignalIndex_ForNextSignal()
    {
        // SIG_A (block, 1 next) -> SIG_B. No direct train at SIG_B,
        // but train T1 has SIG_B in the earlierSignalIndex.
        var signals = new[]
        {
            MakeSignal("SIG_A", "block",
                nextSignals: [new("SIG_B", null)]),
            MakeSignal("SIG_B")
        };

        var trainT1 = MakeTrain("T1", "en1", "SIG_C@extra", id: "id1");
        var trains = new[] { trainT1 };

        var sut = CreateService(signals);
        sut.SetLastSignalCache(trainT1.GetTrainId(), "SIG_B");

        var result = await sut.GetSignalsForTrains(trains);

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.TrainsAhead.Should().BeEquivalentTo("T1");
    }

    [Fact]
    public async Task ChainedSignals_SetsNextSignalWithTrainAhead_ForMainFinalized()
    {
        // SIG_A (main, finalized, 1 next) -> SIG_B (main, finalized, 1 next) -> SIG_C (has train)
        var signals = new[]
        {
            MakeSignal("SIG_A", "main", true,
                [new("SIG_B", null)]),
            MakeSignal("SIG_B", "main", true,
                [new("SIG_C", null)]),
            MakeSignal("SIG_C")
        };
        var trains = new[] { MakeTrain("T1", "en1", "SIG_C@extra") };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        var sigB = result.Single(s => s.Name == "SIG_B");
        sigB.TrainsAhead.Should().BeEquivalentTo("T1");

        var sigA = result.Single(s => s.Name == "SIG_A");
        sigA.NextSignalWithTrainAhead.Should().Be("SIG_B");
    }

    // ──────────────────────────────────────────────
    //  Bug reproduction: orange signal turns green
    //  when a train approaches it
    // ──────────────────────────────────────────────

    [Fact]
    public async Task BlockChain_OrangeSignal_KeepsTrainsAhead_WhenTrainApproaches()
    {
        // Chain: L1_1 → L1_2 → L1_3 → L1_4
        // T1 is at L1_4 (red signal)
        // T2 is approaching L1_2
        // L1_3 should be orange (TrainsAhead from L1_4)
        // L1_2 should also show cautionary (NextSignalWithTrainAhead or TrainsAhead)
        var signals = new[]
        {
            MakeSignal("L1_1", "block",
                nextSignals: [new("L1_2", null)]),
            MakeSignal("L1_2", "block",
                nextSignals: [new("L1_3", null)]),
            MakeSignal("L1_3", "block",
                nextSignals: [new("L1_4", null)]),
            MakeSignal("L1_4", "block")
        };

        var trains = new[]
        {
            MakeTrain("T1", "en1", "L1_4@extra", id: "t1"),
            MakeTrain("T2", "en1", "L1_2@extra", id: "t2")
        };

        var sut = CreateService(signals);
        var result = await sut.GetSignalsForTrains(trains);

        // L1_3: no train at it, but T1 is at L1_4 (next signal) → TrainsAhead should be set
        var l13 = result.Single(s => s.Name == "L1_3");
        l13.TrainsAhead.Should().BeEquivalentTo(["T1"], "L1_3 should show train ahead (T1 at L1_4)");

        // L1_2: T2 is approaching it. T1 is two signals ahead (at L1_4).
        // L1_2 should have NextSignalWithTrainAhead = L1_3 to indicate a train 2 signals ahead
        var l12 = result.Single(s => s.Name == "L1_2");
        l12.Trains.Should().BeEquivalentTo("T2");
        l12.NextSignalWithTrainAhead.Should().Be("L1_3",
            "L1_2 should know there's a train 2 signals ahead via L1_3");
    }

    [Fact]
    public async Task BlockChain_EarlierSignalCache_DoesNotLoseNextSignalWithTrainAhead()
    {
        // Chain: L1_1 → L1_2 → L1_3 → L1_4
        // T1 at L1_4 (red), T1 previously at L1_3 (in cache)
        // L1_2 should still show NextSignalWithTrainAhead even though
        // earlierSignalIndex has a hit for L1_3
        var signals = new[]
        {
            MakeSignal("L1_1", "block",
                nextSignals: [new("L1_2", null)]),
            MakeSignal("L1_2", "block",
                nextSignals: [new("L1_3", null)]),
            MakeSignal("L1_3", "block",
                nextSignals: [new("L1_4", null)]),
            MakeSignal("L1_4", "block")
        };

        var trainT1 = MakeTrain("T1", "en1", "L1_4@extra", id: "t1");
        var trains = new[] { trainT1 };

        var sut = CreateService(signals);
        // T1 previously passed L1_3
        sut.SetLastSignalCache(trainT1.GetTrainId(), "L1_3");

        var result = await sut.GetSignalsForTrains(trains);

        // L1_3: earlierSignalIndex has T1 → TrainsAhead = ["T1"], then continue.
        var l13 = result.Single(s => s.Name == "L1_3");
        l13.TrainsAhead.Should().BeEquivalentTo("T1");

        // L1_2: The next signal is L1_3. No train at L1_3 in signalsIndex,
        // but earlierSignalIndex has L1_3 → TrainsAhead should be ["T1"] from fallback.
        // NextSignalWithTrainAhead: L1_3's next is L1_4, T1 IS at L1_4 → should be "L1_3"
        var l12 = result.Single(s => s.Name == "L1_2");
        l12.TrainsAhead.Should().BeEquivalentTo(["T1"],
            "L1_2 should show train ahead from earlierSignalIndex fallback");
        l12.NextSignalWithTrainAhead.Should().Be("L1_3",
            "L1_2 should know there's also a train 2 signals ahead");
    }

    [Fact]
    public async Task BlockChain_EarlierCacheOnSignal_SkipsNextSignalWithTrainAhead()
    {
        // This test demonstrates the bug: when earlierSignalIndex has a hit
        // for a signal, the `continue` skips the NextSignalWithTrainAhead check.
        //
        // Chain: L1_1 → L1_2 → L1_3
        // T1 at L1_3 (red), T2 was previously at L1_1 (in cache)
        // L1_1 should still get NextSignalWithTrainAhead set
        var signals = new[]
        {
            MakeSignal("L1_1", "block",
                nextSignals: [new("L1_2", null)]),
            MakeSignal("L1_2", "block",
                nextSignals: [new("L1_3", null)]),
            MakeSignal("L1_3", "block")
        };

        var trainT1 = MakeTrain("T1", "en1", "L1_3@extra", id: "t1");
        var trainT2 = MakeTrain("T2", "en1", "L1_2@extra", id: "t2");
        var trains = new[] { trainT1, trainT2 };

        var sut = CreateService(signals);
        // T2 was previously at L1_1 (just passed it, now at L1_2)
        sut.SetLastSignalCache(trainT2.GetTrainId(), "L1_1");

        var result = await sut.GetSignalsForTrains(trains);

        // L1_1: earlierSignalIndex hit → TrainsAhead = ["T2"] → continue
        // This means NextSignalWithTrainAhead is never set!
        var l11 = result.Single(s => s.Name == "L1_1");
        l11.TrainsAhead.Should().BeEquivalentTo("T2");

        l11.NextSignalWithTrainAhead.Should().Be("L1_2",
            "L1_1 should know there's a train 2 signals ahead even when earlierSignalIndex has data");
    }

    // ──────────────────────────────────────────────
    //  Testable subclass
    // ──────────────────────────────────────────────

    private class TestableSignalAnalyzerService : SignalAnalyzerService
    {
        private readonly SignalStatus[] _signals;

        public TestableSignalAnalyzerService(
            ILogger<SignalAnalyzerService> logger,
            IServiceScopeFactory scopeFactory,
            SignalStatus[] signals)
            : base(logger, scopeFactory)
        {
            _signals = signals;
        }

        protected override Task<SignalStatus[]> GetSignals()
        {
            return Task.FromResult(_signals);
        }

        public void SetLastSignalCache(string trainId, string signalName)
        {
            var field = typeof(SignalAnalyzerService)
                .GetField("_trainLastSignalCache",
                    BindingFlags.NonPublic | BindingFlags.Instance)!;
            var cache = (TtlCache<string, string>)field.GetValue(this)!;
            cache.Set(trainId, signalName);
        }

        public void SetPassedSignalCache(string trainId, string signalName)
        {
            var field = typeof(SignalAnalyzerService)
                .GetField("_trainPassedSignalCache",
                    BindingFlags.NonPublic | BindingFlags.Instance)!;
            var cache = (TtlCache<string, string>)field.GetValue(this)!;
            cache.Set(trainId, signalName);
        }
    }
}