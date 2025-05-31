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

    private const double MinDistance = 200; // in meters

    private static readonly Gauge RoutePointQueueGauge = Metrics
        .CreateGauge("smo_route_point_queue", "Number of items in the route point queue");

    private readonly ILogger<RoutePointAnalyzerService> _logger;
    private readonly QueueProcessor<Dictionary<string, Train[]>> _queueProcessor;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TrainDataService _trainDataService;

    private CancellationTokenSource _cancellationTokenSource;
    private Task? _cleanOldLines;

    private Task? _cleanRouteLinesTask;

    public RoutePointAnalyzerService(ILogger<RoutePointAnalyzerService> logger,
        IServiceScopeFactory scopeFactory,
        TrainDataService trainDataService)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        _trainDataService = trainDataService;
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

                    await CleanRouteLineGaps(context, cancellationToken);

                    await CleanTooManyLines(context, cancellationToken);
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
            // Clean route lines with gaps
            // If a route line has a gap of more than 2 times the minimum distance, remove the whole line
            _logger.LogInformation("Removing route lines with gaps...");
            var routePoints = await context.RoutePoints
                .GroupBy(rp => new { rp.RouteId, rp.RunId, rp.TrainId })
                .Select(g => new { g.Key.RouteId, g.Key.RunId, g.Key.TrainId })
                .ToListAsync(cancellationToken);

            var counter = 0;

            foreach (var routePoint in routePoints)
            {
                var pointsToRemove = await context.RoutePoints.Where(rp =>
                        rp.RouteId == routePoint.RouteId && rp.RunId == routePoint.RunId &&
                        rp.TrainId == routePoint.TrainId)
                    .ToListAsync(cancellationToken);

                var gaps = pointsToRemove
                    .OrderBy(p => p.Id)
                    .Select(p => p.Point)
                    .ToList();

                for (var i = 1; i < gaps.Count; i++)
                {
                    var distance = gaps[i].Distance(gaps[i - 1]);
                    if (!(distance > MinDistance * 2)) continue;

                    _logger.LogInformation("Removing route line {Id} with gap of {Distance} meters",
                        $"{routePoint.RouteId}:{routePoint.RunId}:{routePoint.TrainId}",
                        distance);
                    context.RoutePoints.RemoveRange(pointsToRemove);
                    counter++;
                    break;
                }
            }

            await context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Removed {Count} route lines with gaps",
                counter);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Error cleaning route lines with gaps");
        }
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

        // Create a semaphore to limit parallelism to 3 threads
        var semaphore = new SemaphoreSlim(10, 50);

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
                        : (ShouldAdd: true, Point: new RoutePoint(train));
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

            var points = await context.RoutePoints
                .Where(rp => rp.RouteId == trainNoLocal)
                .OrderBy(rp => rp.Id)
                .Select(rp => new { rp.RouteId, rp.TrainId, rp.RunId, rp.Point.Coordinate })
                .ToArrayAsync();

            var lines = points
                .GroupBy(p => new { p.RouteId, p.TrainId, p.RunId })
                .Where(g => g.Count() > 20)
                .Select(g => GeoUtils.CatmullRomSplineToLineString(g.Select(x => x.Coordinate).ToList(), 3))
                .ToArray();

            // convert each linestring to wkt
            var wktLines = lines
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
}