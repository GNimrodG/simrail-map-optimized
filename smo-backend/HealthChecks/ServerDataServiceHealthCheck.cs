using Microsoft.Extensions.Diagnostics.HealthChecks;
using SMOBackend.Services;

namespace SMOBackend.HealthChecks;

public class ServerDataServiceHealthCheck(ServerDataService service) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(
            service.Data != null
                ? service.Data.Length > 0
                    ? HealthCheckResult.Healthy()
                    : HealthCheckResult.Degraded("Server data is empty")
                : HealthCheckResult.Unhealthy("Server data not available"));
    }
}