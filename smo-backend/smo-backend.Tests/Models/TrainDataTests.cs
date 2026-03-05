using FluentAssertions;
using NetTopologySuite.Geometries;
using SMOBackend.Models.Trains;

namespace SMOBackend.Tests.Models;

/// <summary>
///     Unit tests for <see cref="TrainData" /> and <see cref="BaseTrainData" /> methods.
/// </summary>
public class TrainDataTests
{
    // ──────────────────────────────────────────────
    //  GetSignal Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void GetSignal_ExtractsSignalName_WhenSignalInFrontHasExtra()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var signal = trainData.GetSignal();

        signal.Should().Be("SIG_A");
    }

    [Fact]
    public void GetSignal_ReturnsNull_WhenSignalInFrontIsNull()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = null,
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var signal = trainData.GetSignal();

        signal.Should().BeNull();
    }

    [Fact]
    public void GetSignal_ReturnsNull_WhenSignalInFrontIsEmpty()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var signal = trainData.GetSignal();

        signal.Should().BeNull();
    }

    [Fact]
    public void GetSignal_HandlesSignalWithoutExtra()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var signal = trainData.GetSignal();

        signal.Should().Be("SIG_A");
    }

    [Fact]
    public void GetSignal_HandlesMultipleAtSymbols()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra@more",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var signal = trainData.GetSignal();

        signal.Should().Be("SIG_A");
    }

    // ──────────────────────────────────────────────
    //  GetSignalExtra Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void GetSignalExtra_ExtractsExtraData_WhenSignalInFrontHasExtra()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra_data",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var extra = trainData.GetSignalExtra();

        extra.Should().Be("extra_data");
    }

    [Fact]
    public void GetSignalExtra_ReturnsNull_WhenSignalInFrontIsNull()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = null,
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var extra = trainData.GetSignalExtra();

        extra.Should().BeNull();
    }

    [Fact]
    public void GetSignalExtra_ReturnsNull_WhenSignalInFrontIsEmpty()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var extra = trainData.GetSignalExtra();

        extra.Should().BeNull();
    }

    // ──────────────────────────────────────────────
    //  Location Property Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void Location_ReturnsPoint_WhenLatitudeAndLongitudeAreSet()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40,
            Latitude = 51.0,
            Longitude = 19.0
        };

        var location = trainData.Location;

        location.Should().NotBeNull();
        location!.X.Should().Be(19.0);
        location.Y.Should().Be(51.0);
        location.SRID.Should().Be(4326);
    }

    [Fact]
    public void Location_ReturnsNull_WhenLatitudeIsNull()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40,
            Latitude = null,
            Longitude = 19.0
        };

        var location = trainData.Location;

        location.Should().BeNull();
    }

    [Fact]
    public void Location_ReturnsNull_WhenLongitudeIsNull()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40,
            Latitude = 51.0,
            Longitude = null
        };

        var location = trainData.Location;

        location.Should().BeNull();
    }

    [Fact]
    public void Location_ReturnsOriginalLocation_WhenSet()
    {
        var originalPoint = new Point(20.0, 52.0) { SRID = 4326 };
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40,
            Latitude = 51.0,
            Longitude = 19.0,
            OriginalLocation = originalPoint
        };

        var location = trainData.Location;

        location.Should().BeSameAs(originalPoint);
    }
}