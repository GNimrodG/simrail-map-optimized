using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using SMOBackend.Data;

namespace SMOBackend.HealthChecks;

/// <summary>
/// Health check for the database.
/// </summary>
public class DatabaseHealthCheck(IServiceScopeFactory scopeFactory, ILogger<DatabaseHealthCheck> logger)
    : IHealthCheck
{
    /// <inheritdoc />
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Create a fresh scope and context to avoid shared state issues
            using var scope = scopeFactory.CreateScope();
            await using var dbContext = scope.ServiceProvider.GetRequiredService<SmoContext>();

            // Set a shorter timeout for health checks to avoid blocking
            var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(10));

            // Test actual database functionality with a simple query instead of just connection
            await dbContext.Database.ExecuteSqlRawAsync(
                "SELECT 1",
                timeoutCts.Token);

            logger.LogDebug("Database health check passed");
            return HealthCheckResult.Healthy("Database is responsive");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Database health check was cancelled");
            return HealthCheckResult.Unhealthy("Database health check was cancelled");
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Database health check timed out after 10 seconds");
            return HealthCheckResult.Unhealthy("Database connection timeout");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database health check failed: {Message}", ex.Message);
            return HealthCheckResult.Unhealthy($"Database error: {ex.Message}");
        }
    }
}