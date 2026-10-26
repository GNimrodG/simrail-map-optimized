using FluentAssertions;
using SMOBackend.Models;

namespace SMOBackend.Tests.Models;

/// <summary>
///     Unit tests for <see cref="SignalConnectionRequest" />.
/// </summary>
public class SignalConnectionRequestTests
{
    // Łazy Łc: LC_T to LC_Tm645, about 250 m east along the track
    private static readonly double[][] Line = [[19.38640, 50.42230], [19.38800, 50.42260], [19.38990, 50.42290]];

    [Fact]
    public void Validate_NoSpeedAndNoLine_IsValid()
    {
        new SignalConnectionRequest().Validate().Should().BeNull();
    }

    [Fact]
    public void Validate_SpeedAndLine_IsValid()
    {
        new SignalConnectionRequest { Vmax = 40, Line = Line }.Validate().Should().BeNull();
    }

    [Fact]
    public void Validate_NegativeSpeed_IsInvalid()
    {
        new SignalConnectionRequest { Vmax = -1 }.Validate().Should().NotBeNull();
    }

    [Fact]
    public void Validate_OnePoint_IsInvalid()
    {
        new SignalConnectionRequest { Line = [[19.3864, 50.4223]] }.Validate().Should().NotBeNull();
    }

    [Theory]
    [InlineData(200.0, 50.0)] // longitude out of range
    [InlineData(19.0, 95.0)] // latitude out of range
    [InlineData(double.NaN, 50.0)]
    public void Validate_PointOutOfRange_IsInvalid(double longitude, double latitude)
    {
        new SignalConnectionRequest { Line = [[19.3864, 50.4223], [longitude, latitude]] }.Validate().Should().NotBeNull();
    }

    [Fact]
    public void Validate_PointWithoutTwoNumbers_IsInvalid()
    {
        new SignalConnectionRequest { Line = [[19.3864, 50.4223], [19.38]] }.Validate().Should().NotBeNull();
    }

    [Fact]
    public void ToLineString_IsLongitudeLatitudeInWgs84()
    {
        var line = new SignalConnectionRequest { Line = Line }.ToLineString()!;

        line.SRID.Should().Be(4326);
        line.NumPoints.Should().Be(3);
        line.GetCoordinateN(0).X.Should().Be(19.38640);
        line.GetCoordinateN(0).Y.Should().Be(50.42230);
    }

    [Fact]
    public void ToLineString_NoLine_IsNull()
    {
        new SignalConnectionRequest().ToLineString().Should().BeNull();
    }

    [Fact]
    public void LengthOf_IsTheDistanceAlongTheLine()
    {
        var line = new SignalConnectionRequest { Line = Line }.ToLineString()!;

        // 0.0035° of longitude at 50.42° N is about 249 m, the latitude adds a little
        SignalConnectionRequest.LengthOf(line).Should().BeInRange(250, 262);
    }
}
