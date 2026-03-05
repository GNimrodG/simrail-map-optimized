using FluentAssertions;
using SMOBackend.Models;

namespace SMOBackend.Tests.Models;

/// <summary>
///     Unit tests for <see cref="SignalStatus" /> model.
/// </summary>
public class SignalStatusTests
{
    [Fact]
    public void PartialSignalStatus_Constructor_CopiesAllProperties()
    {
        var signalStatus = new SignalStatus
        {
            Name = "SIG_A",
            Trains = ["T1", "T2"],
            TrainsAhead = ["T3", "T4"],
            NextSignalWithTrainAhead = "SIG_B"
        };

        var partial = new SignalStatus.PartialSignalStatus(signalStatus);

        partial.Name.Should().Be("SIG_A");
        partial.Trains.Should().BeEquivalentTo("T1", "T2");
        partial.TrainsAhead.Should().BeEquivalentTo("T3", "T4");
        partial.NextSignalWithTrainAhead.Should().Be("SIG_B");
    }

    [Fact]
    public void PartialSignalStatus_Constructor_HandlesNullArrays()
    {
        var signalStatus = new SignalStatus
        {
            Name = "SIG_A",
            Trains = null,
            TrainsAhead = null,
            NextSignalWithTrainAhead = null
        };

        var partial = new SignalStatus.PartialSignalStatus(signalStatus);

        partial.Name.Should().Be("SIG_A");
        partial.Trains.Should().BeNull();
        partial.TrainsAhead.Should().BeNull();
        partial.NextSignalWithTrainAhead.Should().BeNull();
    }

    [Fact]
    public void SignalConnection_Record_CreatesCorrectly()
    {
        var connection = new SignalStatus.SignalConnection("SIG_B", 100);

        connection.Name.Should().Be("SIG_B");
        connection.Vmax.Should().Be(100);
    }

    [Fact]
    public void SignalConnection_Record_HandlesNullVmax()
    {
        var connection = new SignalStatus.SignalConnection("SIG_B", null);

        connection.Name.Should().Be("SIG_B");
        connection.Vmax.Should().BeNull();
    }

    [Fact]
    public void SignalConnection_Record_SupportsEquality()
    {
        var conn1 = new SignalStatus.SignalConnection("SIG_B", 100);
        var conn2 = new SignalStatus.SignalConnection("SIG_B", 100);
        var conn3 = new SignalStatus.SignalConnection("SIG_C", 100);

        conn1.Should().Be(conn2);
        conn1.Should().NotBe(conn3);
    }
}