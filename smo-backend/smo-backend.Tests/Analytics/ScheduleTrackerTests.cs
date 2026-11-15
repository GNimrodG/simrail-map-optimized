using FluentAssertions;
using SMOBackend.Analytics.Schedule;

namespace SMOBackend.Tests.Analytics;

/// <summary>
///     Tests for <see cref="ScheduleTracker" />: a simulated train going north along longitude 19.0, one position a
///     second, past a station (timetable index 1) whose entry and exit signals face north, or past a halt.
/// </summary>
public class ScheduleTrackerTests
{
    private const string Train = "1234@pl1-x";
    private const double Lon = 19.0;
    private const double MetersPerDegreeLat = 110_574.0;

    // the station: entry signal at 1000 m, exit signal at 1600 m (north of 50.0), both for northbound trains
    private static readonly PointGeometry Station = new(
        [new(Lat(1000), Lon, 0), new(Lat(1600), Lon, 0)], null);

    private static double Lat(double metersNorth) => 50.0 + metersNorth / MetersPerDegreeLat;

    /// <summary>
    ///     Drives the train: (seconds, metres north, km/h) every second, with the game's timetable index moving on to
    ///     2 once it's past the exit signal (as the game does).
    /// </summary>
    private static ScheduleTracker Drive(IEnumerable<(int Second, double Meters, double Speed)> path,
        PointGeometry geometry, double movesOnAt = 1650)
    {
        var tracker = new ScheduleTracker();
        foreach (var (second, meters, speed) in path)
        {
            var index = meters >= movesOnAt ? 2 : 1;
            tracker.Update(Train, second * 1000L, new(Lat(meters), Lon), speed, index, i => i == 1 ? geometry : null);
        }

        return tracker;
    }

    /// <summary>At 20 m/s from 0 m, stopping at 1300 m for a minute, then on at 20 m/s (no acceleration).</summary>
    private static IEnumerable<(int, double, double)> StopAtPlatform(int stopFor = 60, double stopAt = 1300)
    {
        var second = 0;
        for (var m = 0.0; m < stopAt; m += 20) yield return (second++, m, 72);
        for (var i = 0; i < stopFor; i++) yield return (second++, stopAt, 0);
        for (var m = stopAt + 20; m <= 3000; m += 20) yield return (second++, m, 72);
    }

    [Fact]
    public void StopInTheStation_ArrivalIsTheStopAndDepartureTheSettingOff()
    {
        var times = Drive(StopAtPlatform(), Station).GetTimes(Train);

        times.Should().ContainKey(1);
        times[1].Stopped.Should().BeTrue();
        times[1].Arrival.Should().Be(65_000); // 1300 m at 20 m/s
        times[1].Departure.Should().Be(125_000); // a minute later
    }

    [Fact]
    public void PassingThrough_IsHalfwayBetweenTheEntryAndExitSignals()
    {
        var path = Enumerable.Range(0, 150).Select(s => (s, s * 20.0, 72.0));

        var times = Drive(path, Station).GetTimes(Train);

        times[1].Stopped.Should().BeFalse();
        // the entry signal at 50 s, the exit signal at 80 s
        times[1].Arrival!.Value.Should().BeCloseTo(65_000, 100);
        times[1].Departure!.Value.Should().BeCloseTo(65_000, 100);
    }

    [Fact]
    public void StopBeforeTheEntrySignal_IsNoArrival()
    {
        // waiting at the red entry signal (990 m) for two minutes, then through the station without a stop
        var path = new List<(int, double, double)>();
        var second = 0;
        for (var m = 0.0; m < 990; m += 20) path.Add((second++, m, 72));
        for (var i = 0; i < 120; i++) path.Add((second++, 990, 0));
        for (var m = 1010.0; m <= 3000; m += 20) path.Add((second++, m, 72));

        var times = Drive(path, Station).GetTimes(Train);

        times[1].Stopped.Should().BeFalse();
        times[1].Arrival.Should().BeGreaterThan(120_000);
    }

    [Fact]
    public void StopAfterLeaving_DoesNotMoveTheDeparture()
    {
        // past the exit signal it stops again (at the next block signal, 2500 m)
        var path = new List<(int, double, double)>();
        var second = 0;
        foreach (var (_, m, v) in StopAtPlatform())
        {
            path.Add((second++, m, v));
            if (Math.Abs(m - 2500) < 1)
                for (var i = 0; i < 60; i++) path.Add((second++, 2500, 0));
        }

        var times = Drive(path, Station).GetTimes(Train);

        times[1].Departure.Should().Be(125_000);
    }

    [Fact]
    public void NotLeftYet_HasTheArrivalOnly()
    {
        var path = StopAtPlatform().Take(100); // still standing at the platform

        var times = Drive(path, Station).GetTimes(Train);

        times[1].Arrival.Should().Be(65_000);
        times[1].Departure.Should().BeNull();
    }

    [Fact]
    public void SignalsOfAnotherTrackOrDirection_AreNotCrossed()
    {
        // the same signals facing south (the other direction), and northbound ones 30 m to the side (another track)
        var geometry = new PointGeometry(
            [new(Lat(1000), Lon, 180), new(Lat(1600), Lon, 180), new(Lat(1000), Lon + 30 / 71_500.0, 0)], null);

        var times = Drive(StopAtPlatform(), geometry).GetTimes(Train);

        times.Should().NotContainKey(1);
    }

    [Fact]
    public void CrossingTime_IsInterpolatedBetweenPositions()
    {
        var signal = new BoundarySignal(Lat(1000), Lon, 0);

        // from 990 m to 1030 m in one second: the signal is a quarter of the way
        ScheduleTracker.CrossingTime(signal, 10_000, new(Lat(990), Lon), 11_000, new(Lat(1030), Lon))
            !.Value.Should().BeCloseTo(10_250, 5);
        // going south past a northbound signal: no crossing
        ScheduleTracker.CrossingTime(signal, 10_000, new(Lat(1030), Lon), 11_000, new(Lat(990), Lon))
            .Should().BeNull();
    }

    [Fact]
    public void Halt_StopNearIt()
    {
        var halt = new PointGeometry([], new(Lat(1250), Lon));

        var times = Drive(StopAtPlatform(), halt, movesOnAt: 1400).GetTimes(Train);

        times[1].Stopped.Should().BeTrue();
        times[1].Arrival.Should().Be(65_000);
        times[1].Departure.Should().Be(125_000);
    }

    [Fact]
    public void Halt_PassedWithoutStopping_IsWhenTheTrainWasNearest()
    {
        var halt = new PointGeometry([], new(Lat(1250), Lon));
        var path = Enumerable.Range(0, 150).Select(s => (s, s * 20.0, 72.0));

        var times = Drive(path, halt, movesOnAt: 1300).GetTimes(Train);

        times[1].Stopped.Should().BeFalse();
        times[1].Arrival.Should().Be(62_000); // 1240 m, 10 m short of it (the nearest position)
        times[1].Departure.Should().Be(62_000);
    }

    [Fact]
    public void SpawnedStandingAtTheStation_HasADepartureButNoArrival()
    {
        // first seen standing at the platform, then sets off after 30 s
        var path = Enumerable.Range(0, 30).Select(s => (s, 1300.0, 0.0))
            .Concat(Enumerable.Range(1, 80).Select(s => (29 + s, 1300 + s * 20.0, 72.0)));

        var times = Drive(path, Station).GetTimes(Train);

        times[1].Arrival.Should().BeNull();
        times[1].Departure.Should().Be(30_000);
    }

    [Fact]
    public void Delay_IsAgainstThePlannedTimeInTheServersTimezone()
    {
        // 10:05:30 local (UTC+1) is 09:05:30 server time; planned 10:03:00
        var actual = (long)(new DateTime(2026, 11, 15, 9, 5, 30, DateTimeKind.Utc) - DateTime.UnixEpoch).TotalMilliseconds;

        ScheduleTrackingService.Delay(actual, "2026-11-15 10:03:00", 1).Should().Be(150);
        // planned just before midnight, run just after it: the next day
        ScheduleTrackingService.Delay(actual, "2026-11-14 10:04:00", 1).Should().Be(90);
    }
}
