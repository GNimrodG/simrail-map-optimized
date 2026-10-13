using FluentAssertions;
using SMOBackend.Models;
using SMOBackend.Services;

namespace SMOBackend.Tests.Services;

/// <summary>
///     Unit tests for <see cref="TrainPositionDataService.ApplyHeadings" />.
/// </summary>
public class TrainPositionHeadingTests
{
    // ~0.001° latitude ≈ 110 m, ~0.001° longitude at 52° ≈ 68 m
    private const double Lat = 52.0;
    private const double Lng = 19.0;

    private static TrainPosition Pos(string id, double? lat, double? lng) =>
        new() { Id = id, Latitude = lat, Longitude = lng, Velocity = 100 };

    private static (TrainPosition Position, IReadOnlyDictionary<string, TrainPositionDataService.HeadingAnchor> Anchors)
        Step(IReadOnlyDictionary<string, TrainPositionDataService.HeadingAnchor>? anchors, double? lat, double? lng,
            string id = "T1")
    {
        var position = Pos(id, lat, lng);
        var next = TrainPositionDataService.ApplyHeadings([position], anchors);
        return (position, next);
    }

    [Fact]
    public void FirstPosition_HasNoHeading()
    {
        var (position, anchors) = Step(null, Lat, Lng);

        position.Heading.Should().BeNull();
        anchors.Should().ContainKey("T1");
    }

    [Theory]
    [InlineData(0.001, 0, 0)] // north
    [InlineData(0, 0.001, 90)] // east
    [InlineData(-0.001, 0, 180)] // south
    [InlineData(0, -0.001, 270)] // west
    public void MovingTrain_GetsCompassHeading(double dLat, double dLng, short expected)
    {
        var (_, anchors) = Step(null, Lat, Lng);
        var (position, _) = Step(anchors, Lat + dLat, Lng + dLng);

        position.Heading.Should().Be(expected);
    }

    [Fact]
    public void Heading_IsAlwaysBetween0And359()
    {
        // slightly west of north (~-1.8°) -> 358, not -2
        var (_, anchors) = Step(null, Lat, Lng);
        var (position, _) = Step(anchors, Lat + 0.001, Lng - 0.00005);

        position.Heading.Should().BeInRange((short)0, (short)359);
        position.Heading.Should().Be(358);
    }

    [Fact]
    public void SmallMovement_KeepsPreviousHeading()
    {
        var (_, a1) = Step(null, Lat, Lng);
        var (_, a2) = Step(a1, Lat + 0.001, Lng); // north, 110 m

        // ~2 m east: below the threshold, heading must not flip to east
        var (position, _) = Step(a2, Lat + 0.001, Lng + 0.00003);

        position.Heading.Should().Be(0);
    }

    [Fact]
    public void SlowTrain_HeadingFromAccumulatedMovement()
    {
        // 3 m steps north are each below the threshold, but they add up from the anchor
        var (_, anchors) = Step(null, Lat, Lng);
        TrainPosition position = null!;

        for (var i = 1; i <= 3; i++)
            (position, anchors) = Step(anchors, Lat + i * 0.000027, Lng);

        position.Heading.Should().Be(0);
    }

    [Fact]
    public void StandingTrain_KeepsHeading()
    {
        var (_, a1) = Step(null, Lat, Lng);
        var (_, a2) = Step(a1, Lat, Lng + 0.001); // east

        var (position, _) = Step(a2, Lat, Lng + 0.001);

        position.Heading.Should().Be(90);
    }

    [Fact]
    public void ReversingTrain_FlipsHeading()
    {
        var (_, a1) = Step(null, Lat, Lng);
        var (_, a2) = Step(a1, Lat + 0.001, Lng); // north

        var (position, _) = Step(a2, Lat, Lng); // back south

        position.Heading.Should().Be(180);
    }

    [Fact]
    public void MissingPosition_KeepsHeadingAndAnchor()
    {
        var (_, a1) = Step(null, Lat, Lng);
        var (_, a2) = Step(a1, Lat + 0.001, Lng);

        var (position, a3) = Step(a2, null, null);

        position.Heading.Should().Be(0);
        a3.Should().ContainKey("T1");
    }

    [Fact]
    public void Jump_ResetsHeading()
    {
        var (_, a1) = Step(null, Lat, Lng);
        var (_, a2) = Step(a1, Lat + 0.001, Lng);

        // 11 km in one step: respawn / teleport, not travel
        var (position, a3) = Step(a2, Lat + 0.1, Lng + 0.1);

        position.Heading.Should().BeNull();

        // the next real movement gets a heading again
        var (next, _) = Step(a3, Lat + 0.1, Lng + 0.101);
        next.Heading.Should().Be(90);
    }

    [Fact]
    public void DespawnedTrains_AreDroppedFromAnchors()
    {
        var anchors = TrainPositionDataService.ApplyHeadings([Pos("T1", Lat, Lng), Pos("T2", Lat, Lng)], null);

        var next = TrainPositionDataService.ApplyHeadings([Pos("T2", Lat, Lng)], anchors);

        next.Should().ContainKey("T2").And.NotContainKey("T1");
    }

    [Fact]
    public void ApplyTo_CopiesHeadingToTrain_AndKeepsItWhenUnknown()
    {
        var train = new SMOBackend.Models.Trains.Train
        {
            Id = "T1",
            TrainNoLocal = "1",
            TrainName = "1",
            StartStation = "A",
            EndStation = "B",
            Vehicles = [],
            ServerCode = "en1",
            RunId = "run",
            Type = "bot",
            TrainData = new()
            {
                Velocity = 100,
                DistanceToSignalInFront = 0,
                SignalInFrontSpeed = 0,
                Latitude = Lat,
                Longitude = Lng
            }
        };

        var withHeading = Pos("T1", Lat, Lng);
        withHeading.Heading = 90;
        withHeading.Timestamp = DateTime.UtcNow;
        withHeading.ApplyTo(train);
        train.TrainData.Heading.Should().Be(90);

        var withoutHeading = Pos("T1", Lat, Lng);
        withoutHeading.Timestamp = DateTime.UtcNow;
        withoutHeading.ApplyTo(train);
        train.TrainData.Heading.Should().Be(90);
    }
}
