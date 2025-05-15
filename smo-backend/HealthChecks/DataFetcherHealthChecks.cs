using Microsoft.Extensions.Diagnostics.HealthChecks;
using SMOBackend.Services;

namespace SMOBackend.HealthChecks;

/// <summary>
/// Health check for data services.
/// </summary>
public class DataServiceHealthCheck(IEnumerable<IDataService> dataServices) : IHealthCheck
{
    /// <inheritdoc />
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var unhealthyServices = dataServices
            .Where(service => service.LastFetch > DateTime.UtcNow.Add(service.GetFetchInterval().Negate()))
            .Select(service => service.ServiceId)
            .ToList();

        if (unhealthyServices.Count == 0)
            return Task.FromResult(HealthCheckResult.Healthy("All data services are healthy"));

        if (unhealthyServices.Count == dataServices.Count())
        {
            return Task.FromResult(HealthCheckResult.Unhealthy("All data services are unhealthy",
                data: new Dictionary<string, object>
                {
                    { "UnhealthyServices", unhealthyServices }
                }));
        }

        return Task.FromResult(HealthCheckResult.Degraded(
            "Some data services are unhealthy",
            data: new Dictionary<string, object>
            {
                { "UnhealthyServices", unhealthyServices }
            }));
    }
}