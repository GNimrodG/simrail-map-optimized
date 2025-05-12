using Microsoft.Extensions.Diagnostics.HealthChecks;
using SMOBackend.Data;

namespace SMOBackend.HealthChecks;

public class DatabaseHealthCheck(SmoContext context) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context1, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(
            context.Database.CanConnect() 
                ? HealthCheckResult.Healthy() 
                : HealthCheckResult.Unhealthy("Database connection failed"));
    }
}