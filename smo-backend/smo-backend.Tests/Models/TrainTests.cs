using FluentAssertions;
using SMOBackend.Models.Trains;

namespace SMOBackend.Tests.Models;

/// <summary>
///     Unit tests for <see cref="Train" /> methods.
/// </summary>
public class TrainTests
{
    // ──────────────────────────────────────────────
    //  GetTrainId Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void GetTrainId_ReturnsCorrectFormat()
    {
        var train = new Train
        {
            TrainNoLocal = "T1234",
            TrainName = "Express",
            StartStation = "A",
            EndStation = "B",
            Vehicles = [],
            ServerCode = "en1",
            RunId = "run1",
            Id = "guid123",
            Type = "user",
            TrainData = new()
            {
                Velocity = 50,
                DistanceToSignalInFront = 100,
                SignalInFrontSpeed = 40
            }
        };

        var trainId = train.GetTrainId();

        trainId.Should().Be("T1234@en1-guid123");
    }

    [Theory]
    [InlineData("T1", "en1", "id1", "T1@en1-id1")]
    [InlineData("TDE-123", "pl1", "abc-def", "TDE-123@pl1-abc-def")]
    [InlineData("ROJ", "de1", "12345", "ROJ@de1-12345")]
    public void GetTrainId_WithVariousInputs_ReturnsCorrectFormat(
        string trainNo, string serverCode, string id, string expected)
    {
        var train = new Train
        {
            TrainNoLocal = trainNo,
            TrainName = trainNo,
            StartStation = "A",
            EndStation = "B",
            Vehicles = [],
            ServerCode = serverCode,
            RunId = "run1",
            Id = id,
            Type = "user",
            TrainData = new()
            {
                Velocity = 50,
                DistanceToSignalInFront = 100,
                SignalInFrontSpeed = 40
            }
        };

        var trainId = train.GetTrainId();

        trainId.Should().Be(expected);
    }

    // ──────────────────────────────────────────────
    //  ToString Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void ToString_IncludesSignalInFront_WhenPresent()
    {
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
                SignalInFrontSpeed = 40
            }
        };

        var str = train.ToString();

        str.Should().Contain("T1@en1-id1");
        str.Should().Contain("SIG_A@extra");
    }

    [Fact]
    public void ToString_OmitsSignalInFront_WhenNotPresent()
    {
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
                SignalInFront = null,
                DistanceToSignalInFront = 100,
                SignalInFrontSpeed = 40
            }
        };

        var str = train.ToString();

        str.Should().Be("T1@en1-id1");
    }

    [Fact]
    public void ToString_OmitsSignalInFront_WhenEmpty()
    {
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
                SignalInFront = "",
                DistanceToSignalInFront = 100,
                SignalInFrontSpeed = 40
            }
        };

        var str = train.ToString();

        str.Should().Be("T1@en1-id1");
    }

    // ──────────────────────────────────────────────
    //  PartialTrainData Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void PartialTrainData_Constructor_CopiesAllProperties()
    {
        var train = new Train
        {
            TrainNoLocal = "T1",
            TrainName = "Express",
            StartStation = "A",
            EndStation = "B",
            Vehicles = ["V1", "V2"],
            ServerCode = "en1",
            RunId = "run1",
            Id = "id1",
            Type = "user",
            TrainData = new()
            {
                Velocity = 75.5,
                SignalInFront = "SIG_A@extra",
                DistanceToSignalInFront = 123.45,
                SignalInFrontSpeed = 60,
                ControlledBySteamID = "steam123",
                ControlledByXboxID = "xbox456",
                InBorderStationArea = true,
                Latitude = 51.123,
                Longitude = 19.456,
                VDDelayedTimetableIndex = 5,
                RequiredMapDLCs = [[1, 2], [3, 4]]
            }
        };

        var partial = new Train.PartialTrainData(train);

        partial.Id.Should().Be("id1");
        partial.Type.Should().Be("user");
        partial.Velocity.Should().Be(75.5);
        partial.SignalInFront.Should().Be("SIG_A");
        partial.DistanceToSignalInFront.Should().Be(123.45);
        partial.SignalInFrontSpeed.Should().Be(60);
        partial.ControlledBySteamId.Should().Be("steam123");
        partial.ControlledByXboxId.Should().Be("xbox456");
        partial.InBorderStationArea.Should().BeTrue();
        partial.Latitude.Should().Be(51.123);
        partial.Longitude.Should().Be(19.456);
        partial.VdDelayedTimetableIndex.Should().Be(5);
        partial.RequiredMapDlCs.Should().NotBeNull();
        partial.RequiredMapDlCs!.Length.Should().Be(2);
        partial.RequiredMapDlCs[0].Should().BeEquivalentTo(new uint[] { 1, 2 });
        partial.RequiredMapDlCs[1].Should().BeEquivalentTo(new uint[] { 3, 4 });
    }

    [Fact]
    public void PartialTrainData_Constructor_HandlesNullValues()
    {
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
            Type = "bot",
            TrainData = new()
            {
                Velocity = 0,
                SignalInFront = null,
                DistanceToSignalInFront = 0,
                SignalInFrontSpeed = 0,
                ControlledBySteamID = null,
                ControlledByXboxID = null,
                InBorderStationArea = false,
                Latitude = null,
                Longitude = null,
                VDDelayedTimetableIndex = 0,
                RequiredMapDLCs = null
            }
        };

        var partial = new Train.PartialTrainData(train);

        partial.SignalInFront.Should().BeNull();
        partial.ControlledBySteamId.Should().BeNull();
        partial.ControlledByXboxId.Should().BeNull();
        partial.Latitude.Should().BeNull();
        partial.Longitude.Should().BeNull();
        partial.RequiredMapDlCs.Should().BeNull();
    }

    // ──────────────────────────────────────────────
    //  BaseTrainData.GetSignalExtra Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void BaseTrainData_GetSignalExtra_ExtractsExtra()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra_info",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var extra = trainData.GetSignalExtra();

        extra.Should().Be("extra_info");
    }

    [Fact]
    public void BaseTrainData_GetSignalExtra_ReturnsNull_WhenNoExtra()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var extra = trainData.GetSignalExtra();

        extra.Should().BeNull();
    }

    [Fact]
    public void BaseTrainData_GetSignalExtra_HandlesMultipleAtSymbols()
    {
        var trainData = new TrainData
        {
            Velocity = 50,
            SignalInFront = "SIG_A@extra@more",
            DistanceToSignalInFront = 100,
            SignalInFrontSpeed = 40
        };

        var extra = trainData.GetSignalExtra();

        extra.Should().Be("extra");
    }
}