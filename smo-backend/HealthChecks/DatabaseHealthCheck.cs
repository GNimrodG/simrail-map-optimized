using Microsoft.Extensions.Diagnostics.HealthChecks;
using SMOBackend.Data;

namespace SMOBackend.HealthChecks;

/// <summary>
/// Health check for the database.
/// </summary>
public class DatabaseHealthCheck(SmoContext context) : IHealthCheck
{
    /// <inheritdoc />
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context1, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(
            context.Database.CanConnect() 
                ? HealthCheckResult.Healthy() 
                : HealthCheckResult.Unhealthy("Database connection failed"));
    }
}