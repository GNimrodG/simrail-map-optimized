namespace SMOBackend.Analytics.Schedule;

/// <summary>
///     Where a timetable point is, to tell when a train arrives at it and leaves it: a station by its main signals (a
///     train enters the station at the first one it passes and leaves it at the last one, its exit signal), a halt by
///     its position (it has no signals).
/// </summary>
/// <param name="Signals">The station's main signals, each facing the direction of travel it's for.</param>
/// <param name="Stop">The halt's position, for a point without signals.</param>
public sealed record PointGeometry(IReadOnlyList<BoundarySignal> Signals, GeoPoint? Stop)
{
    /// <summary>Whether there is anything to track the point by.</summary>
    public bool IsKnown => Signals.Count > 0 || Stop != null;
}

/// <summary>A position in WGS84 degrees.</summary>
public readonly record struct GeoPoint(double Lat, double Lon);

/// <summary>A signal at a station's boundary, with the direction of travel (degrees) of the trains it's for.</summary>
public readonly record struct BoundarySignal(double Lat, double Lon, double Heading);

/// <summary>
///     The times a train reached and left a timetable point (milliseconds of server time), null where not known.
/// </summary>
/// <param name="Arrival">When it stopped at the point, or passed it without stopping.</param>
/// <param name="Departure">
///     When it set off again after its stop, or passed the point without stopping. Only set once the train has left
///     the point.
/// </param>
/// <param name="Stopped">Whether it stopped at the point.</param>
public readonly record struct PointTimes(long? Arrival, long? Departure, bool Stopped);

/// <summary>
///     Follows the trains' positions and tells when they arrive at and leave their timetable points, from where the
///     points are (<see cref="PointGeometry" />) instead of the game's timetable index, which only moves on once a train
///     has passed the exit signal: it says nothing about arrivals or stops, and the time it moves on is late by however
///     long the train took from its stop to the exit signal.
///     <para>
///         For a station, a train passes one of its main signals when it goes from behind the signal to beyond it
///         (along the signal's direction of travel, within <see cref="MaxLateralOffset" /> of it: not a signal of a
///         parallel track facing the other way). The first one it passes is where it enters the station, the last one
///         where it leaves. A stop in between is its arrival (the first stop) and departure (setting off after the last
///         one); without a stop it passed the station halfway between the two. For a halt, a stop within
///         <see cref="StopRadius" /> of it, or the moment it was nearest.
///     </para>
///     Only the train's current and previous timetable points are followed (the game's index: the next point it
///     hasn't left yet), so a station on another line close by never counts. Not thread-safe per train; different
///     trains may be updated in parallel.
/// </summary>
public sealed class ScheduleTracker
{
    /// <summary>How far to the side of a signal a train may pass it (metres): the track the signal is for.</summary>
    public const double MaxLateralOffset = 20.0;

    /// <summary>How near a halt (metres from its position, the middle of the platform) a train stops at it.</summary>
    public const double StopRadius = 250.0;

    /// <summary>Below this speed (km/h) a train is standing.</summary>
    public const double StopSpeed = 1.0;

    /// <summary>A jump further than this between two positions (metres) isn't a move (a respawn): no crossing.</summary>
    private const double MaxStep = 1000.0;

    private const double MetersPerDegreeLat = 110_574.0;
    private const double MetersPerDegreeLonAtEquator = 111_320.0;

    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, TrainState> _trains = new();

    /// <summary>
    ///     Takes a train's new position.
    /// </summary>
    /// <param name="trainId">The train.</param>
    /// <param name="time">Server time of the position (milliseconds).</param>
    /// <param name="position">Where it is.</param>
    /// <param name="speed">Its speed (km/h).</param>
    /// <param name="timetableIndex">The game's timetable index: the next point it hasn't left yet.</param>
    /// <param name="geometryOf">Where the train's timetable point with an index is, null when not known.</param>
    public void Update(string trainId, long time, GeoPoint position, double speed, int timetableIndex,
        Func<int, PointGeometry?> geometryOf)
    {
        var state = _trains.GetOrAdd(trainId, _ => new());
        var previous = state.Last;
        state.Last = (time, position);
        var standing = speed < StopSpeed;

        // a train first seen standing is at its point already (spawned there): no crossing to enter it by
        if (previous == null)
        {
            if (standing) state.Visit(timetableIndex).StartedInside = true;
            return;
        }

        var (lastTime, lastPosition) = previous.Value;
        if (time <= lastTime) return;
        var moved = Distance(lastPosition, position) <= MaxStep;

        for (var index = Math.Max(0, timetableIndex - 1); index <= timetableIndex; index++)
        {
            var geometry = geometryOf(index);
            if (geometry is not { IsKnown: true }) continue;

            var visit = state.Visit(index);
            if (visit.Left) continue;

            if (geometry.Signals.Count > 0)
            {
                if (moved)
                {
                    foreach (var signal in geometry.Signals)
                    {
                        if (CrossingTime(signal, lastTime, lastPosition, time, position) is not { } crossed) continue;
                        visit.EnteredAt ??= crossed;
                        visit.LastCrossingAt = crossed;
                    }
                }

                visit.Inside = visit.StartedInside || visit.EnteredAt != null;
            }
            else
            {
                var distance = Distance(position, geometry.Stop!.Value);
                visit.Inside = distance <= StopRadius;
                if (visit.Inside && distance < visit.ClosestDistance)
                {
                    visit.ClosestDistance = distance;
                    visit.ClosestAt = time;
                }

                if (visit.Inside || visit.ClosestAt != null) visit.EnteredAt ??= time;
            }

            // (not once it has left: a stop further on, at the next block signal, isn't one here)
            if (visit.Inside && visit.LeftAt == null) TrackStop(visit, time, standing);

            // the game has moved on from this point: the train has left it (for a halt, once it's out of reach too)
            if (index < timetableIndex && (geometry.Signals.Count > 0 || !visit.Inside)) visit.LeftAt ??= time;
        }

        // the points before the previous one are done
        foreach (var index in state.Visits.Keys.Where(i => i < timetableIndex - 1).ToList())
            state.Visits[index].Left = true;
    }

    /// <summary>
    ///     The times of the train's timetable points, by timetable index.
    /// </summary>
    public IReadOnlyDictionary<int, PointTimes> GetTimes(string trainId)
    {
        if (!_trains.TryGetValue(trainId, out var state)) return new Dictionary<int, PointTimes>();

        var times = new Dictionary<int, PointTimes>();
        foreach (var (index, visit) in state.Visits)
            if (visit.Times() is { } t)
                times[index] = t;
        return times;
    }

    /// <summary>Forgets a train (despawned).</summary>
    public void Remove(string trainId) => _trains.TryRemove(trainId, out _);

    /// <summary>The trains it follows.</summary>
    public ICollection<string> TrainIds => _trains.Keys;

    private static void TrackStop(PointVisit visit, long time, bool standing)
    {
        if (standing)
        {
            visit.FirstStopAt ??= time;
            visit.StandingSince ??= time;
            visit.SetOffAt = null;
        }
        else if (visit.StandingSince != null)
        {
            visit.StandingSince = null;
            visit.SetOffAt = time;
        }
    }

    /// <summary>
    ///     When the train went past the signal between two positions (interpolated), or null if it didn't: from behind
    ///     it to beyond it along the signal's direction of travel, passing within <see cref="MaxLateralOffset" />.
    /// </summary>
    internal static long? CrossingTime(BoundarySignal signal, long fromTime, GeoPoint from, long toTime, GeoPoint to)
    {
        var (ax, ay) = Local(signal, from);
        var (bx, by) = Local(signal, to);
        var heading = signal.Heading * Math.PI / 180.0;
        var (ux, uy) = (Math.Sin(heading), Math.Cos(heading));

        var before = ax * ux + ay * uy;
        var after = bx * ux + by * uy;
        if (before >= 0 || after < 0) return null;

        var fraction = before / (before - after);
        var (cx, cy) = (ax + fraction * (bx - ax), ay + fraction * (by - ay));
        if (Math.Abs(cx * uy - cy * ux) > MaxLateralOffset) return null;

        return fromTime + (long)Math.Round(fraction * (toTime - fromTime));
    }

    /// <summary>Metres east and north of the signal.</summary>
    private static (double X, double Y) Local(BoundarySignal origin, GeoPoint p) =>
        ((p.Lon - origin.Lon) * MetersPerDegreeLonAtEquator * Math.Cos(origin.Lat * Math.PI / 180.0),
            (p.Lat - origin.Lat) * MetersPerDegreeLat);

    /// <summary>The distance between two positions (metres, flat: they are close).</summary>
    internal static double Distance(GeoPoint a, GeoPoint b)
    {
        var dx = (b.Lon - a.Lon) * MetersPerDegreeLonAtEquator * Math.Cos((a.Lat + b.Lat) / 2 * Math.PI / 180.0);
        var dy = (b.Lat - a.Lat) * MetersPerDegreeLat;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    private sealed class TrainState
    {
        public (long Time, GeoPoint Position)? Last;
        public readonly Dictionary<int, PointVisit> Visits = [];

        public PointVisit Visit(int index)
        {
            if (!Visits.TryGetValue(index, out var visit)) Visits[index] = visit = new();
            return visit;
        }
    }

    private sealed class PointVisit
    {
        public bool StartedInside;
        public bool Inside;
        public long? EnteredAt;
        public long? LastCrossingAt;
        public long? ClosestAt;
        public double ClosestDistance = double.MaxValue;
        public long? FirstStopAt;
        public long? StandingSince;
        public long? SetOffAt;
        public long? LeftAt;
        public bool Left;

        public PointTimes? Times()
        {
            var stopped = FirstStopAt != null;
            var left = LeftAt != null || Left;
            long? arrival, departure;

            if (stopped)
            {
                // a train that started here (spawned) didn't arrive (its first crossing is the exit signal)
                arrival = StartedInside ? null : FirstStopAt;
                // set off after its last stop; without one seen (gone on standing), when it was last seen leaving
                departure = left ? SetOffAt ?? LastCrossingAt ?? LeftAt : null;
            }
            else if (ClosestAt != null) // a halt passed without a stop
            {
                arrival = ClosestAt;
                departure = left ? ClosestAt : null;
            }
            else if (EnteredAt != null) // a station passed without a stop: halfway through it
            {
                if (!left) return new(null, null, false);
                var through = EnteredAt.Value + ((LastCrossingAt ?? EnteredAt.Value) - EnteredAt.Value) / 2;
                arrival = departure = through;
            }
            else
            {
                return null;
            }

            return arrival == null && departure == null ? null : new PointTimes(arrival, departure, stopped);
        }
    }
}
