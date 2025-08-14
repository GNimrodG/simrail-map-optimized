using System.Collections.Concurrent;
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
///     Represents a group of route points with the same RouteId, RunId, and TrainId.
/// </summary>
/// <param name="RouteId">The route identifier</param>
/// <param name="RunId">The run identifier</param>
/// <param name="TrainId">The train identifier</param>
/// <param name="Count">The number of route points in this group</param>
public record RoutePointGroup(string RouteId, string RunId, string TrainId);

/// <summary>
/// Service for analyzing route points with optimized performance for high-throughput scenarios.
/// </summary>
/// <remarks>
/// This service processes train location data, creates route points, and performs cleanup operations.
/// </remarks>
public class RoutePointAnalyzerService : IHostedService
{
    /// <summary>
    ///     Cleanup interval for old route lines in hours.
    /// </summary>
    private const int CleanupIntervalHours = 48;

    /// <summary>
    ///     Minimum distance between route points in meters to avoid duplicate entries.
    /// </summary>
    private const double MinDistance = 200;

    /// <summary>
    ///     Maximum batch size for database operations to optimize memory usage and performance.
    /// </summary>
    private const int MaxBatchSize = 500; // Reduced from 1000 to decrease memory pressure

    /// <summary>
    ///     Maximum degree of parallelism for train data processing.
    /// </summary>
    private static readonly int MaxConcurrency = Math.Min(Environment.ProcessorCount, 2); // Reduced concurrency

    /// <summary>
    ///     Prometheus gauge for monitoring route point queue size.
    /// </summary>
    private static readonly Gauge RoutePointQueueGauge = Metrics
        .CreateGauge("smo_route_point_queue", "Number of items in the route point queue");

    /// <summary>
    ///     Prometheus counter for processed route points.
    /// </summary>
    private static readonly Counter ProcessedPointsCounter = Metrics
        .CreateCounter("smo_route_points_processed_total", "Total number of route points processed");

    /// <summary>
    ///     Prometheus histogram for processing time tracking.
    /// </summary>
    private static readonly Histogram ProcessingTimeHistogram = Metrics
        .CreateHistogram("smo_route_point_processing_duration_seconds", "Time spent processing route points");

    /// <summary>
    ///     Cache for active train run IDs to avoid repeated database queries.
    /// </summary>
    private readonly ConcurrentDictionary<string, DateTime> _activeTrainCache = new();

    /// <summary>
    ///     Caching service for reducing database load.
    /// </summary>
    private readonly CachingService _cachingService;

    /// <summary>
    ///     Logger instance for this service.
    /// </summary>
    private readonly ILogger<RoutePointAnalyzerService> _logger;

    /// <summary>
    ///     Queue processor for handling train data asynchronously.
    /// </summary>
    private readonly QueueProcessor<Dictionary<string, Train[]>> _queueProcessor;

    /// <summary>
    ///     Service scope factory for creating database contexts.
    /// </summary>
    private readonly IServiceScopeFactory _scopeFactory;

    /// <summary>
    ///     Signal analyzer service for determining signal connections.
    /// </summary>
    private readonly SignalAnalyzerService _signalAnalyzerService;

    /// <summary>
    ///     Train data service for receiving live train updates.
    /// </summary>
    private readonly TrainDataService _trainDataService;

    private HashSet<string>? _allowedServers;

    /// <summary>
    ///     Cancellation token source for coordinating service shutdown.
    /// </summary>
    private CancellationTokenSource _cancellationTokenSource;

    /// <summary>
    ///     Background task for cleaning old route lines.
    /// </summary>
    private Task? _cleanOldLines;

    /// <summary>
    ///     Background task for cleaning route lines with gaps and too many points.
    /// </summary>
    private Task? _cleanRouteLinesTask;

    /// <inheritdoc cref="RoutePointAnalyzerService" />
    public RoutePointAnalyzerService(ILogger<RoutePointAnalyzerService> logger,
        IServiceScopeFactory scopeFactory,
        TrainDataService trainDataService,
        SignalAnalyzerService signalAnalyzerService,
        CachingService cachingService)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _trainDataService = trainDataService;
        _signalAnalyzerService = signalAnalyzerService;
        _cachingService = cachingService;
        _cancellationTokenSource = new();
        _queueProcessor = new(logger,
            ProcessTrainData,
            RoutePointQueueGauge);
    }

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (string.Equals(Environment.GetEnvironmentVariable("ROUTE_POINT_ANALYZER_DISABLED"), "true",
                StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation(
                "Route point analyzer service is disabled (unset ROUTE_POINT_ANALYZER_DISABLED=true to enable)");
            return Task.CompletedTask;
        }

        _logger.LogInformation("Starting route point analyzer service...");

        // Initialize allowed servers from environment variable
        var allowedServersEnv = Environment.GetEnvironmentVariable("ROUTE_POINT_ANALYZER_ALLOWED_SERVERS");
        if (!string.IsNullOrEmpty(allowedServersEnv))
        {
            _allowedServers = new(allowedServersEnv.Split(',').Select(s => s.Trim()));
            _logger.LogInformation("Allowed servers for route point analyzer: {AllowedServers}",
                string.Join(", ", _allowedServers));
        }

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
    /// Optimized with bulk operations and batch processing.
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

    /// <summary>
    ///     Optimized route line gap cleaning with bulk operations and improved caching.
    /// </summary>
    private async Task CleanRouteLineGaps(SmoContext context, CancellationToken cancellationToken)
    {
        try
        {
            // Get active trains from cache first, then from service
            var now = DateTime.UtcNow;
            var activeTrainKeys = _activeTrainCache
                .Where(kvp => now - kvp.Value < TimeSpan.FromMinutes(10))
                .Select(kvp => kvp.Key)
                .ToHashSet();

            if (activeTrainKeys.Count == 0)
            {
                await _trainDataService.FirstDataReceived;
                var activeTrains = _trainDataService.Data ?? new Dictionary<string, Train[]>();
                activeTrainKeys = activeTrains.Values
                    .SelectMany(trains => trains)
                    .Select(train => train.RunId)
                    .ToHashSet();

                // Update cache
                foreach (var runId in activeTrainKeys) _activeTrainCache.TryAdd(runId, now);
            }

            // Use compiled query for better performance
            var routePointGroups = await context.RoutePoints
                .Where(rp => !rp.RunId.Contains("_seg"))
                .GroupBy(rp => new { rp.RouteId, rp.RunId, rp.TrainId })
                .Select(g => new { g.Key.RouteId, g.Key.RunId, g.Key.TrainId, Count = g.Count() })
                .Where(g => g.Count > 1)
                .ToListAsync(cancellationToken);

            // Convert to records after materialization
            var routePointGroupRecords = routePointGroups
                .Select(g => new RoutePointGroup(g.RouteId, g.RunId, g.TrainId))
                .ToList();

            // Filter out active trains and process in batches
            var inactiveGroups = routePointGroupRecords
                .Where(g => !activeTrainKeys.Contains(g.RunId))
                .ToList();

            var splitCounter = 0;
            const int batchSize = 50; // Process in smaller batches to avoid memory issues

            for (var i = 0; i < inactiveGroups.Count; i += batchSize)
            {
                var batch = inactiveGroups.Skip(i).Take(batchSize);
                var (pointsToAdd, pointsToRemove, batchSplitCount) =
                    await ProcessRouteLineBatch(context, batch, cancellationToken);

                if (pointsToRemove.Count > 0)
                {
                    // Use bulk operations for better performance
                    await context.Database.ExecuteSqlRawAsync(
                        "DELETE FROM route_points WHERE id = ANY(@ids)",
                        [new NpgsqlParameter("@ids", pointsToRemove.Select(p => p.Id).ToArray())],
                        cancellationToken);

                    await context.RoutePoints.AddRangeAsync(pointsToAdd, cancellationToken);
                    await context.SaveChangesAsync(cancellationToken);
                }

                splitCounter += batchSplitCount;
            }

            _logger.LogInformation("Split {Count} route lines with gaps", splitCounter);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Error splitting route lines with gaps");
        }
    }

    /// <summary>
    ///     Processes a batch of route lines for gap splitting with optimized memory usage.
    /// </summary>
    private async Task<(List<RoutePoint> PointsToAdd, List<RoutePoint> PointsToRemove, int SplitCount)>
        ProcessRouteLineBatch(
            SmoContext context,
            IEnumerable<RoutePointGroup> routePointGroups,
            CancellationToken cancellationToken)
    {
        var pointsToAdd = new List<RoutePoint>();
        var pointsToRemove = new List<RoutePoint>();
        var splitCounter = 0;

        foreach (var routePoint in routePointGroups)
        {
            var points = await context.RoutePoints
                .Where(rp => rp.RouteId == routePoint.RouteId &&
                             rp.RunId == routePoint.RunId &&
                             rp.TrainId == routePoint.TrainId)
                .OrderBy(p => p.CreatedAt)
                .ToListAsync(cancellationToken);

            if (points.Count <= 1) continue;

            var segments = SplitPointsAtGaps(points, MinDistance * 2);

            if (segments.Count is <= 1 or > 999) continue;

            _logger.LogInformation("Splitting route line {Id} into {SegmentCount} segments",
                $"{routePoint.RouteId}:{routePoint.RunId}:{routePoint.TrainId}",
                segments.Count);

            pointsToRemove.AddRange(points);

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

        return (pointsToAdd, pointsToRemove, splitCounter);
    }

    /// <summary>
    /// Splits a list of route points into segments at gap points.
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

            if (i == 0)
            {
                currentSegment.Add(currentPoint);
                continue;
            }

            var previousPoint = points[i - 1];
            var distance = currentPoint.Point.HaversineDistance(previousPoint.Point);

            if (distance > maxGapDistance)
            {
                if (currentSegment.Count > 1) segments.Add(currentSegment);
                currentSegment = [currentPoint];
            }
            else
            {
                currentSegment.Add(currentPoint);
            }
        }

        if (currentSegment.Count > 1) segments.Add(currentSegment);

        return segments;
    }

    /// <summary>
    ///     Optimized cleanup of route lines with bulk delete operations.
    /// </summary>
    private async Task CleanTooManyLines(SmoContext context, CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation("Removing route lines with too many points...");

            // Use a single optimized query with bulk delete
            const string sql = """
                               WITH route_rankings AS (
                                   SELECT route_id, run_id, train_id,
                                          ROW_NUMBER() OVER (PARTITION BY route_id ORDER BY MAX(created_at) DESC) as rn
                                   FROM route_points
                                   GROUP BY route_id, run_id, train_id
                               )
                               DELETE FROM route_points
                               WHERE (route_id, run_id, train_id) IN (
                                   SELECT route_id, run_id, train_id
                                   FROM route_rankings
                                   WHERE rn > 3
                               )
                               """;

            var deletedCount = await context.Database.ExecuteSqlRawAsync(sql, cancellationToken);
            _logger.LogInformation("Removed {Count} old route lines", deletedCount);
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
    /// This method runs every 24 hours and removes line routes older than <see cref="CleanupIntervalHours"/>.
    /// Optimized with bulk delete operations.
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

                    // Use bulk delete with a single SQL statement
                    const string sql = """
                                       WITH old_routes AS (
                                           SELECT route_id, run_id, train_id
                                           FROM route_points
                                           GROUP BY route_id, run_id, train_id
                                           HAVING MAX(created_at) < @cutoffTime
                                       )
                                       DELETE FROM route_points
                                       WHERE (route_id, run_id, train_id) IN (
                                           SELECT route_id, run_id, train_id FROM old_routes
                                       )
                                       """;

                    var deletedCount = await context.Database.ExecuteSqlRawAsync(
                        sql,
                        [new NpgsqlParameter("@cutoffTime", cutoffTime)],
                        cancellationToken);

                    if (deletedCount == 0)
                    {
                        _logger.LogInformation("No route lines older than {CleanupIntervalHours} hours found",
                            CleanupIntervalHours);
                    }
                    else
                    {
                        _logger.LogInformation("Removed {Count} old route lines", deletedCount);
                    }
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

    /// <summary>
    ///     Handles incoming train data events by queuing them for processing.
    /// </summary>
    private void OnTrainDataReceived(Dictionary<string, Train[]> data)
    {
        try
        {
            _logger.LogTrace("Received train data for {ServerCount} servers", data.Count);

            // Update active train cache
            var now = DateTime.UtcNow;
            foreach (var train in data.Values.SelectMany(v => v))
                _activeTrainCache.AddOrUpdate(train.RunId, now, (_, _) => now);

            if (_allowedServers != null)
                // Filter data to only include allowed servers
                data = data.Where(kvp => _allowedServers.Contains(kvp.Key))
                    .ToDictionary(kvp => kvp.Key, kvp => kvp.Value);

            _queueProcessor.Enqueue(data);
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "Error processing train data");
        }
    }

    /// <summary>
    ///     Processes train data with optimized parallel processing and bulk database operations.
    /// </summary>
    private async Task ProcessTrainData(Dictionary<string, Train[]> data)
    {
        if (data.Count == 0 || data.Values.All(v => v.Length == 0))
        {
            _logger.LogWarning("No train data received");
            return;
        }

        using var _ = ProcessingTimeHistogram.NewTimer();
        _logger.LogInformation("Processing train data...");

        var stopwatch = Stopwatch.StartNew();

        // Filter out trains without location data
        var trainsWithLocation = data.Values
            .SelectMany(v => v)
            .Where(t => t.TrainData.Location != null)
            .ToList();

        // Process in optimized batches
        var pointsToAdd = new ConcurrentBag<RoutePoint>();
        var processedCount = 0;
        var discardedCount = 0;

        var semaphore = new SemaphoreSlim(MaxConcurrency, MaxConcurrency);
        var tasks = new List<Task>();

        // Process trains in parallel with controlled concurrency
        foreach (var trainBatch in trainsWithLocation.Chunk(50))
        {
            await semaphore.WaitAsync();

            tasks.Add(Task.Run(async () =>
            {
                try
                {
                    var batchResults = await ProcessTrainBatch(trainBatch);

                    foreach (var point in batchResults.PointsToAdd) pointsToAdd.Add(point);

                    Interlocked.Add(ref processedCount, batchResults.ProcessedCount);
                    Interlocked.Add(ref discardedCount, batchResults.DiscardedCount);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing train batch");
                }
                finally
                {
                    // ReSharper disable once AccessToDisposedClosure
                    semaphore.Release();
                }
            }));
        }

        await Task.WhenAll(tasks);
        semaphore.Dispose();

        // Bulk insert all points
        var allPointsToAdd = pointsToAdd.ToList();
        if (allPointsToAdd.Count > 0) await BulkInsertRoutePoints(allPointsToAdd);

        stopwatch.Stop();

        ProcessedPointsCounter.Inc(processedCount);

        _logger.LogInformation(
            "Processed {AddedPoints} added and {DiscardedPoints} discarded route points in {ElapsedMilliseconds} ms",
            allPointsToAdd.Count, discardedCount, stopwatch.ElapsedMilliseconds);

        await _scopeFactory.LogStat("ROUTEPOINT", (int)stopwatch.ElapsedMilliseconds, allPointsToAdd.Count,
            discardedCount);
    }

    /// <summary>
    ///     Processes a batch of trains with optimized database queries.
    /// </summary>
    private async Task<(List<RoutePoint> PointsToAdd, int ProcessedCount, int DiscardedCount)> ProcessTrainBatch(
        Train[] trains)
    {
        var pointsToAdd = new List<RoutePoint>();
        var processedCount = 0;
        var discardedCount = 0;

        // Batch the distance calculations for better performance
        var trainQueries = trains.Select(train => new
        {
            Train = train,
            Query = GetNearestPointQuery(train.TrainNoLocal, train.RunId, train.Id, train.TrainData.Location!)
        }).ToList();

        foreach (var item in trainQueries)
            try
            {
                var distance = await item.Query;
                processedCount++;

                if (distance >= MinDistance)
                {
                    var routePoint = new RoutePoint(item.Train,
                        _signalAnalyzerService.GetTrainPassedSignalName(item.Train.GetTrainId()));
                    pointsToAdd.Add(routePoint);
                }
                else
                {
                    discardedCount++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing train {TrainId}", item.Train.GetTrainId());
                discardedCount++;
            }

        return (pointsToAdd, processedCount, discardedCount);
    }

    /// <summary>
    ///     Optimized bulk insert operation for route points.
    /// </summary>
    private async Task BulkInsertRoutePoints(List<RoutePoint> points)
    {
        using var scope = _scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        // Process in batches to avoid memory issues
        for (var i = 0; i < points.Count; i += MaxBatchSize)
        {
            var batch = points.Skip(i).Take(MaxBatchSize).ToList();

            context.ChangeTracker.AutoDetectChangesEnabled = false;
            await context.RoutePoints.AddRangeAsync(batch);

            try
            {
                await context.SaveChangesAsync(acceptAllChangesOnSuccess: false);
                context.ChangeTracker.AcceptAllChanges();
            }
            finally
            {
                context.ChangeTracker.AutoDetectChangesEnabled = true;
                context.ChangeTracker.Clear(); // Clear to free memory
            }
        }
    }

    /// <summary>
    /// Gets the distance to the nearest route point with optimized query and caching.
    /// </summary>
    /// <param name="routeId">The route identifier</param>
    /// <param name="runId">The run identifier</param>
    /// <param name="trainId">The train identifier</param>
    /// <param name="point">The point to check distance from</param>
    /// <returns>A task that returns the distance to the nearest route point in meters</returns>
    private async Task<double> GetNearestPointQuery(string routeId, string runId, string trainId, Point point)
    {
        // Create a cache key for this distance calculation
        var cacheKey = $"distance:{routeId}:{runId}:{trainId}:{point.X:F4}:{point.Y:F4}";

        return await _cachingService.GetOrSetAsync(
            cacheKey,
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

                // Use spatial query to find the nearest point efficiently
                const string sql = """
                                   SELECT COALESCE(
                                       MIN(ST_Distance(ST_Transform(point, 3857), ST_Transform(ST_GeomFromText($1, 4326), 3857))),
                                       $6
                                   ) as distance
                                   FROM route_points
                                   WHERE route_id = $2
                                     AND run_id = $3
                                     AND train_id = $4
                                     AND created_at > $5
                                   """;

                var pointWkt = point.AsText();
                var cutoffTime = DateTime.UtcNow.AddMinutes(-10); // Only check recent points
                const double
                    maxDistance = MinDistance * 2; // Use a large enough max distance to ensure we get a valid result

                await using var command = context.Database.GetDbConnection().CreateCommand();
                command.CommandText = sql;

                var p1 = command.CreateParameter();
                p1.Value = pointWkt;
                command.Parameters.Add(p1);

                var p2 = command.CreateParameter();
                p2.Value = routeId;
                command.Parameters.Add(p2);

                var p3 = command.CreateParameter();
                p3.Value = runId;
                command.Parameters.Add(p3);

                var p4 = command.CreateParameter();
                p4.Value = trainId;
                command.Parameters.Add(p4);

                var p5 = command.CreateParameter();
                p5.Value = cutoffTime;
                command.Parameters.Add(p5);

                var p6 = command.CreateParameter();
                p6.Value = maxDistance;
                command.Parameters.Add(p6);

                await context.Database.OpenConnectionAsync();
                await using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                    return reader.GetDouble(0);

                return maxDistance;
            },
            TimeSpan.FromSeconds(30), // Very short cache for distance calculations
            TimeSpan.FromMinutes(2)
        );
    }

    /// <summary>
    /// Gets the route points for a specific train with optimized queries and caching.
    /// </summary>
    /// <param name="trainNoLocal">The train number in local format</param>
    /// <returns>An array of WKT representations of the route points</returns>
    public async Task<string[]> GetTrainRoutePoints(string trainNoLocal)
    {
        var cacheKey = $"train-routes:{trainNoLocal}";

        return await _cachingService.GetOrSetAsync(
            cacheKey,
            async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

                    // Optimized query with better indexing hints
                    const string sql = """
                                       WITH valid_runs AS (
                                           SELECT 
                                               route_id, 
                                               train_id, 
                                               run_id, 
                                               MAX(created_at) as latest
                                           FROM route_points 
                                           WHERE route_id = @trainNoLocal
                                           GROUP BY route_id, train_id, run_id
                                           HAVING COUNT(*) > 20
                                           ORDER BY latest DESC
                                           LIMIT 10
                                       ),
                                       route_coords AS (
                                           SELECT 
                                               rp.route_id, 
                                               rp.train_id, 
                                               rp.run_id, 
                                               ST_X(rp.point) as x,
                                               ST_Y(rp.point) as y,
                                               rp.created_at
                                           FROM route_points rp
                                           INNER JOIN valid_runs vr ON rp.route_id = vr.route_id 
                                                                   AND rp.train_id = vr.train_id 
                                                                   AND rp.run_id = vr.run_id
                                           ORDER BY rp.run_id, rp.created_at
                                       )
                                       SELECT ST_AsText(ST_MakeLine(ST_Point(x, y) ORDER BY created_at)) as line_wkt
                                       FROM route_coords
                                       GROUP BY route_id, train_id, run_id
                                       """;

                    var results = await context.Database
                        .SqlQueryRaw<string>(sql, new NpgsqlParameter("@trainNoLocal", trainNoLocal))
                        .ToArrayAsync();

                    return results;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting route points for train {TrainNoLocal}", trainNoLocal);
                    return [];
                }
            },
            TimeSpan.FromMinutes(5),
            TimeSpan.FromMinutes(15)
        ) ?? [];
    }

    /// <summary>
    /// Gets the routes with valid lines using optimized query.
    /// </summary>
    public async Task<string[]> GetRoutesWithValidLines()
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

            const string sql = """
                               SELECT DISTINCT route_id
                               FROM route_points
                               GROUP BY route_id, train_id, run_id
                               HAVING COUNT(*) > 20
                               ORDER BY route_id
                               """;

            var routes = await context.Database
                .SqlQueryRaw<string>(sql)
                .ToArrayAsync();

            return routes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting routes with valid lines");
            return [];
        }
    }

    /// <summary>
    /// Gets the lines for a specific signal with optimized filtering.
    /// </summary>
    public async Task<string[]> GetLinesForSignal(string signalId, int maxLines = 5)
    {
        try
        {
            return await GetFilteredRouteLines(
                "WHERE next_signal = @signalId",
                [new("@signalId", signalId)],
                maxLines);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting lines for signal {SignalId}", signalId);
            return [];
        }
    }

    /// <summary>
    /// Gets the lines for a specific signal connection with optimized filtering.
    /// </summary>
    public async Task<string[]> GetLinesForSignalConnection(string prevSignalId, string nextSignalId, int maxLines = 5)
    {
        try
        {
            return await GetFilteredRouteLines(
                "WHERE prev_signal = @prevSignalId AND next_signal = @nextSignalId",
                [new("@prevSignalId", prevSignalId), new("@nextSignalId", nextSignalId)],
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
    /// Optimized helper method using raw SQL for better performance.
    /// </summary>
    private async Task<string[]> GetFilteredRouteLines(string whereClause, NpgsqlParameter[] parameters, int maxLines)
    {
        using var scope = _scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        var sql = $"""
                   WITH filtered_points AS (
                       SELECT train_id, run_id, point, created_at
                       FROM route_points
                       {whereClause}
                       ORDER BY created_at
                   ),
                   grouped_lines AS (
                       SELECT train_id, run_id, 
                              ST_AsText(ST_MakeLine(point ORDER BY created_at)) as line_wkt,
                              COUNT(*) as point_count
                       FROM filtered_points
                       GROUP BY train_id, run_id
                       HAVING COUNT(*) > 2
                   )
                   SELECT line_wkt
                   FROM grouped_lines
                   ORDER BY point_count DESC
                   LIMIT @maxLines
                   """;

        var allParams = new List<NpgsqlParameter>();
        allParams.AddRange(parameters);
        allParams.Add(new("@maxLines", maxLines));

        var results = await context.Database
            .SqlQueryRaw<string>(sql, allParams.ToArray())
            .ToArrayAsync();

        return results;
    }
}