using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Npgsql;
using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models.Entity;
using SMOBackend.Models.Trains;
using SMOBackend.Services;
using SMOBackend.Utils;

// ReSharper disable FormatStringProblem

namespace SMOBackend.Analytics;

/// <summary>
/// Service for analyzing route points.
/// </summary>
public class RoutePointAnalyzerService : IHostedService
{
    private const int CleanupIntervalHours = 48; // in hours

    private const double MinDistance = 100; // in meters

    private static readonly Gauge RoutePointQueueGauge = Metrics
        .CreateGauge("smo_route_point_queue", "Number of items in the route point queue");

    private readonly ILogger<RoutePointAnalyzerService> _logger;
    private readonly QueueProcessor<Dictionary<string, Train[]>> _queueProcessor;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly SignalAnalyzerService _signalAnalyzerService;
    private readonly TrainDataService _trainDataService;

    private CancellationTokenSource _cancellationTokenSource;
    private Task? _cleanOldLines;

    private Task? _cleanRouteLinesTask;

    /// <inheritdoc cref="RoutePointAnalyzerService" />
    public RoutePointAnalyzerService(ILogger<RoutePointAnalyzerService> logger,
        IServiceScopeFactory scopeFactory,
        TrainDataService trainDataService,
        SignalAnalyzerService signalAnalyzerService)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _trainDataService = trainDataService;
        _signalAnalyzerService = signalAnalyzerService;
        _cancellationTokenSource = new();
        _queueProcessor = new(logger,
            ProcessTrainData,
            RoutePointQueueGauge);
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting route point analyzer service...");

        _cancellationTokenSource = new();

        _trainDataService.DataReceived += OnTrainDataReceived;

        // Start tasks for periodic cleanup
        _cleanRouteLinesTask = Task.Run(() => CleanRouteLines(_cancellationTokenSource.Token), cancellationToken);
        _cleanOldLines = Task.Run(() => CleanOldLines(_cancellationTokenSource.Token), cancellationToken);

        _logger.LogInformation("Started route point analyzer service");

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping route point analyzer service...");
        await _cancellationTokenSource.CancelAsync();

        _trainDataService.DataReceived -= OnTrainDataReceived;
        _queueProcessor.ClearQueue();

        // Wait for tasks to complete
        await Task.WhenAll(_cleanRouteLinesTask!, _cleanOldLines!);

        _logger.LogInformation("Stopped route point analyzer service");
    }

    /// <summary>
    /// Cleans up route lines with less than 20 points and route lines with gaps.
    /// </summary>
    /// <remarks>
    /// This method runs every hour and performs both cleanup tasks in the same thread.
    /// It uses a periodic timer to wait for the next tick.
    /// </remarks>
    private async Task CleanRouteLines(CancellationToken cancellationToken)
    {
        try
        {
            using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

                    _logger.LogInformation("Cleaning route lines...");
                    await CleanRouteLineGaps(context, cancellationToken);

                    await CleanTooManyLines(context, cancellationToken);
                    _logger.LogInformation("Cleaning route lines completed");
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Error cleaning route lines");
                }
            } while (await timer.WaitForNextTickAsync(cancellationToken));
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Cleaning route lines task was canceled");
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Error in route point analyzer service");
        }
    }

    private async Task CleanRouteLineGaps(SmoContext context, CancellationToken cancellationToken)
    {
        try
        {
            // Split route lines with gaps into multiple lines

            // Get currently active trains from the train data service
            await _trainDataService.FirstDataReceived;
            var activeTrains = _trainDataService.Data ?? new Dictionary<string, Train[]>();
            var activeTrainKeys = activeTrains.Values
                .SelectMany(trains => trains)
                .Select(train => train.RunId)
                .ToHashSet();

            // First get all route point groups, then filter in memory
            var allRoutePoints = await context.RoutePoints
                .GroupBy(rp => new { rp.RouteId, rp.RunId, rp.TrainId })
                .Select(g => new { g.Key.RouteId, g.Key.RunId, g.Key.TrainId })
                .Where(g => !g.RunId.Contains("_seg")) // Ignore already segmented routes
                .ToListAsync(cancellationToken);

            // Filter out active trains in memory
            var routePoints = allRoutePoints
                .Where(g => !activeTrainKeys.Contains(g.RunId))
                .ToList();

            var splitCounter = 0;
            var pointsToAdd = new List<RoutePoint>();
            var pointsToRemove = new List<RoutePoint>();

            foreach (var routePoint in routePoints)
            {
                var points = await context.RoutePoints.Where(rp =>
                        rp.RouteId == routePoint.RouteId && rp.RunId == routePoint.RunId &&
                        rp.TrainId == routePoint.TrainId)
                    .OrderBy(p => p.CreatedAt)
                    .ToListAsync(cancellationToken);

                if (points.Count <= 1) continue;

                var segments = SplitPointsAtGaps(points, MinDistance * 2); // Split at gaps larger than 2x MinDistance

                // Only process if we actually split the line and have a reasonable number of segments
                if (segments.Count is <= 1 or > 999) continue;

                _logger.LogInformation("Splitting route line {Id} into {SegmentCount} segments",
                    $"{routePoint.RouteId}:{routePoint.RunId}:{routePoint.TrainId}",
                    segments.Count);

                // Remove original points
                pointsToRemove.AddRange(points);

                // Create new points for each segment with unique RunIds
                for (var segmentIndex = 0; segmentIndex < segments.Count; segmentIndex++)
                {
                    var segment = segments[segmentIndex];
                    var newRunId = $"{routePoint.RunId}_seg{segmentIndex:00}";

                    pointsToAdd.AddRange(segment.Select(point =>
                        new RoutePoint(routePoint.RouteId, newRunId, routePoint.TrainId, point.Point,
                                point.InsidePlayArea, point.NextSignal, point.PrevSignal, point.ServerCode)
                            { CreatedAt = point.CreatedAt }));
                }

                splitCounter++;
            }

            if (pointsToRemove.Count > 0)
            {
                context.RoutePoints.RemoveRange(pointsToRemove);
                await context.RoutePoints.AddRangeAsync(pointsToAdd, cancellationToken);
                await context.SaveChangesAsync(cancellationToken);
            }

            _logger.LogInformation("Split {Count} route lines with gaps into {TotalSegments} segments",
                splitCounter, pointsToAdd.GroupBy(p => p.RunId).Count());
            _logger.LogInformation("Splitting route lines with gaps...");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Error splitting route lines with gaps");
        }
    }

    /// <summary>
    ///     Splits a list of route points into segments at gap points.
    /// </summary>
    /// <param name="points">The ordered list of route points</param>
    /// <param name="maxGapDistance">Maximum allowed distance between consecutive points</param>
    /// <returns>List of point segments</returns>
    private static List<List<RoutePoint>> SplitPointsAtGaps(List<RoutePoint> points, double maxGapDistance)
    {
        var segments = new List<List<RoutePoint>>();
        var currentSegment = new List<RoutePoint>();

        for (var i = 0; i < points.Count; i++)
        {
            var currentPoint = points[i];

            // Always add the first point
            if (i == 0)
            {
                currentSegment.Add(currentPoint);
                continue;
            }

            var previousPoint = points[i - 1];
            var distance = currentPoint.Point.HaversineDistance(previousPoint.Point);

            // If gap is too large, start a new segment
            if (distance > maxGapDistance)
            {
                // Save current segment if it has enough points
                if (currentSegment.Count > 1) segments.Add(currentSegment);

                // Start new segment with current point
                currentSegment = [currentPoint];
            }
            else
            {
                // Add to current segment
                currentSegment.Add(currentPoint);
            }
        }

        // Add the last segment if it has enough points
        if (currentSegment.Count > 1) segments.Add(currentSegment);

        return segments;
    }

    private async Task CleanTooManyLines(SmoContext context, CancellationToken cancellationToken)
    {
        try
        {
            // only keep the last 3 lines per RouteId
            _logger.LogInformation("Removing route lines with too many points...");
            var routeLines = await context.RoutePoints
                .GroupBy(rp => new { rp.RouteId, rp.RunId, rp.TrainId })
                .Select(g => new { g.Key.RouteId, g.Key.RunId, g.Key.TrainId, Latest = g.Max(x => x.CreatedAt) })
                .OrderByDescending(g => g.Latest)
                .ToListAsync(cancellationToken);

            var routeGroups = routeLines
                .GroupBy(r => r.RouteId)
                .Where(g => g.Count() > 3)
                .SelectMany(g => g.OrderByDescending(x => x.Latest).Skip(3))
                .ToList();

            foreach (var routePoint in routeGroups)
            {
                await context.RoutePoints.Where(rp =>
                        rp.RouteId == routePoint.RouteId && rp.RunId == routePoint.RunId &&
                        rp.TrainId == routePoint.TrainId)
                    .ExecuteDeleteAsync(cancellationToken);
            }

            _logger.LogInformation("Removed {Count} route lines that were too old",
                routeGroups.Count);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Error cleaning route lines with too many points");
        }
    }

    /// <summary>
    /// Cleans up line routes older than <see cref="CleanupIntervalHours"/> hours.
    /// </summary>
    /// <remarks>
    /// This method runs every 24 hour and removes line routes older than <see cref="CleanupIntervalHours"/>
    /// It uses a periodic timer to wait for the next tick.
    /// </remarks>
    private async Task CleanOldLines(CancellationToken cancellationToken)
    {
        try
        {
            using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
            do
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

                    _logger.LogInformation("Removing route lines older than {CleanupIntervalHours} hours...",
                        CleanupIntervalHours);

                    var cutoffTime = DateTime.UtcNow.AddHours(-CleanupIntervalHours);

                    var routeLines = await context.RoutePoints
                        .GroupBy(rp => new { rp.RouteId, rp.RunId, rp.TrainId })
                        .Select(g => new
                            { g.Key.RouteId, g.Key.RunId, g.Key.TrainId, Latest = g.Max(x => x.CreatedAt) })
                        .OrderByDescending(g => g.Latest)
                        .ToListAsync(cancellationToken);

                    var pointsToRemove = routeLines
                        .Where(g => g.Latest < cutoffTime)
                        .SelectMany(g => context.RoutePoints
                            .Where(rp => rp.RouteId == g.RouteId && rp.RunId == g.RunId && rp.TrainId == g.TrainId))
                        .ToList();

                    if (pointsToRemove.Count == 0)
                    {
                        _logger.LogInformation("No route lines older than {CleanupIntervalHours} hours found",
                            CleanupIntervalHours);
                        continue;
                    }

                    // Remove the points
                    context.RoutePoints.RemoveRange(pointsToRemove);
                    await context.SaveChangesAsync(cancellationToken);

                    _logger.LogInformation("Removed {Count} route lines older than {CleanupIntervalHours} hours",
                        pointsToRemove.Count, CleanupIntervalHours);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Error cleaning route lines older than {CleanupIntervalHours} hours",
                        CleanupIntervalHours);
                }
            } while (await timer.WaitForNextTickAsync(cancellationToken));
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Cleaning old lines task was canceled");
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Error in route point analyzer service");
        }
    }

    private void OnTrainDataReceived(Dictionary<string, Train[]> data)
    {
        try
        {
            _logger.LogTrace("Received train data for {ServerCount} servers", data.Count);

            _queueProcessor.Enqueue(data);
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Error processing train data");
        }
    }

    private async Task ProcessTrainData(Dictionary<string, Train[]> data)
    {
        if (data.Count == 0 || data.Values.All(v => v.Length == 0))
        {
            _logger.LogWarning("No train data received");
            return;
        }

        _logger.LogInformation("Processing train data...");

        var stopwatch = Stopwatch.StartNew();

        // Filter out trains without location data first
        var trainsWithLocation = data.Values
            .SelectMany(v => v)
            .Where(t => t.TrainData.Location != null)
            .ToList();

        var semaphore = new SemaphoreSlim(10, 70);

        // Create lists to track tasks and results
        var tasks = new List<Task<(bool ShouldAdd, RoutePoint? Point)>>();

        // Start processing each train in parallel
        foreach (var train in trainsWithLocation)
        {
            await semaphore.WaitAsync();

            tasks.Add(Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

                    var closestPoint = await GetNearestPoint(context, train.TrainNoLocal, train.RunId, train.Id,
                        train.TrainData.Location!);

                    return closestPoint < MinDistance
                        ? (ShouldAdd: false, Point: null)
                        : (ShouldAdd: true,
                            Point: new RoutePoint(train,
                                _signalAnalyzerService.GetTrainPassedSignalName(train.GetTrainId())));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing train data for train {TrainId}", train.GetTrainId());
                    return (ShouldAdd: false, Point: null);
                }
                finally
                {
                    // ReSharper disable once AccessToDisposedClosure
                    semaphore.Release();
                }
            }));
        }

        // Wait for all tasks to complete
        var results = await Task.WhenAll(tasks);

        semaphore.Dispose();

        // Process results
        var pointsToAdd = results.Where(r => r.ShouldAdd).Select(r => r.Point!).ToList();
        var addedPoints = pointsToAdd.Count;
        var discardedPoints = results.Length - addedPoints;

        // Add all points to the database
        if (pointsToAdd.Count > 0)
        {
            using var scope = _scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

            // Disable auto-detect changes for better performance
            var wasEnabled = context.ChangeTracker.AutoDetectChangesEnabled;
            context.ChangeTracker.AutoDetectChangesEnabled = false;

            await context.RoutePoints.AddRangeAsync(pointsToAdd);

            try
            {
                await context.SaveChangesAsync(acceptAllChangesOnSuccess: false);
                context.ChangeTracker.AcceptAllChanges();
            }
            finally
            {
                context.ChangeTracker.AutoDetectChangesEnabled = wasEnabled;
            }
        }

        stopwatch.Stop();

        _logger.LogInformation(
            "Processed {AddedPoints} added and {DiscardedPoints} discarded route points in {ElapsedMilliseconds} ms",
            addedPoints, discardedPoints, stopwatch.ElapsedMilliseconds);

        await _scopeFactory.LogStat(
            "ROUTEPOINT",
            (int)stopwatch.ElapsedMilliseconds,
            addedPoints,
            discardedPoints
        );
    }

    /// <summary>
    /// Gets the distance to the nearest route point matching the specified criteria.
    /// </summary>
    /// <param name="dbContext">The database context</param>
    /// <param name="routeId">The route identifier</param>
    /// <param name="runId">The run identifier</param>
    /// <param name="trainId">The train identifier</param>
    /// <param name="point">The reference point to measure distance from</param>
    /// <returns>The distance in meters to the nearest point, or double.MaxValue if no points found</returns>
    private static async Task<double> GetNearestPoint(SmoContext dbContext, string routeId, string runId,
        string trainId, Point point)
    {
        // Build SQL query using ST_DistanceSphere for more accurate geographic distance calculation
        const string
            sql = """
                  SELECT 
                      ST_DistanceSphere(
                          ST_GeomFromText(@pointWkt, 4326),
                          point
                      ) as "Value"
                  FROM route_points
                  WHERE route_id = @routeId 
                    AND run_id = @runId 
                    AND train_id = @trainId
                  ORDER BY "Value"
                  LIMIT 1
                  """;

        // Convert Point to WKT (Well-Known Text) format
        var pointWkt = point.AsText();

        // Execute raw query with parameters
        var result = await dbContext.Database
            .SqlQueryRaw<double?>(sql,
                new NpgsqlParameter("@pointWkt", pointWkt),
                new NpgsqlParameter("@routeId", routeId),
                new NpgsqlParameter("@runId", runId),
                new NpgsqlParameter("@trainId", trainId))
            .FirstOrDefaultAsync();

        // Return the distance or double.MaxValue if no points found
        return result ?? double.MaxValue;
    }

    /// <summary>
    /// Gets the route points for a specific train.
    /// </summary>
    /// <param name="trainNoLocal">The train number in local format</param>
    /// <returns>An array of WKT (Well-Known Text) representations of the route points</returns>
    public async Task<string[]> GetTrainRoutePoints(string trainNoLocal)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

            // First, get route line metadata with point counts to filter at database level
            var validRunIds = await context.RoutePoints
                .Where(rp => rp.RouteId == trainNoLocal)
                .GroupBy(rp => new { rp.RouteId, rp.TrainId, rp.RunId })
                .Where(g => g.Count() > 20)
                .OrderByDescending(g => g.Max(x => x.CreatedAt)) // Get most recent routes first
                .Take(10) // Limit to prevent excessive memory usage
                .Select(g => g.Key.RunId)
                .ToHashSetAsync();

            if (validRunIds.Count == 0)
                return [];

            // Fetch coordinates for valid route lines only
            var points = await context.RoutePoints
                .Where(rp => rp.RouteId == trainNoLocal && validRunIds.Contains(rp.RunId))
                .OrderBy(rp => rp.RunId)
                .ThenBy(rp => rp.CreatedAt)
                .Select(rp => new { rp.RouteId, rp.TrainId, rp.RunId, rp.Point.Coordinate })
                .ToArrayAsync();

            // Group and process in parallel
            var lines = points
                .GroupBy(p => new { p.RouteId, p.TrainId, p.RunId })
                .AsParallel()
                .WithDegreeOfParallelism(Environment.ProcessorCount)
                .Select(g => GeoUtils.CatmullRomSplineToLineString(g.Select(x => x.Coordinate).ToList(), 3))
                .ToArray();

            // Convert to WKT in parallel
            var wktLines = lines
                .AsParallel()
                .Select(l => l.AsText())
                .ToArray();

            return wktLines;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting route points for train {TrainNoLocal}", trainNoLocal);
            return [];
        }
    }

    /// <summary>
    /// Gets the routes with valid lines (more than 20 points).
    /// </summary>
    /// <returns>An array of route identifiers</returns>
    public async Task<string[]> GetRoutesWithValidLines()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

            var routes = await context.RoutePoints
                .GroupBy(rp => new { rp.RouteId, rp.TrainId, rp.RunId })
                .Where(g => g.Count() > 20)
                .Select(g => g.Key)
                .OrderBy(x => x.RouteId)
                .ToArrayAsync();

            return routes.Select(r => r.RouteId).Distinct().ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting routes with valid lines");
            return [];
        }
    }

    /// <summary>
    ///     Gets the lines for a specific signal.
    /// </summary>
    /// <param name="signalId">The signal identifier</param>
    /// <param name="maxLines">Maximum number of lines to return</param>
    /// <returns>An array of WKT (Well-Known Text) representations of the lines</returns>
    public async Task<string[]> GetLinesForSignal(string signalId, int maxLines = 5)
    {
        try
        {
            return await GetFilteredRouteLines(
                context => context.RoutePoints.Where(rp => rp.NextSignal == signalId),
                maxLines);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting lines for signal {SignalId}", signalId);
            return [];
        }
    }

    /// <summary>
    ///     Gets the lines for a specific signal connection.
    /// </summary>
    public async Task<string[]> GetLinesForSignalConnection(string prevSignalId, string nextSignalId, int maxLines = 5)
    {
        try
        {
            return await GetFilteredRouteLines(
                context => context.RoutePoints.Where(rp =>
                    rp.PrevSignal == prevSignalId && rp.NextSignal == nextSignalId),
                maxLines);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting lines for signal connection {PrevSignalId} -> {NextSignalId}",
                prevSignalId, nextSignalId);
            return [];
        }
    }

    /// <summary>
    ///     Helper method to get filtered route lines with common processing logic.
    /// </summary>
    private async Task<string[]> GetFilteredRouteLines(Func<SmoContext, IQueryable<RoutePoint>> filterFunc,
        int maxLines)
    {
        using var scope = _scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        var points = await filterFunc(context)
            .OrderBy(rp => rp.CreatedAt)
            .Select(rp => new { rp.TrainId, rp.RunId, rp.Point.Coordinate })
            .ToArrayAsync();

        var lines = points
            .GroupBy(p => new { p.TrainId, p.RunId })
            .Where(g => g.Count() > 2)
            .Select(g => GeoUtils.CatmullRomSplineToLineString(g.Select(x => x.Coordinate).ToList(), 1))
            .ToArray();

        // Limit the number of lines to maxLines, prioritizing the longest lines
        if (lines.Length > maxLines)
            lines = lines.OrderByDescending(l => l.Coordinates.Length).Take(maxLines).ToArray();

        // convert each linestring to wkt
        return lines.Select(l => l.AsText()).ToArray();
    }
}