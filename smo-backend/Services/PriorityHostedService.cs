using System.Diagnostics;

namespace SMOBackend.Services;

/// <summary>
///     Service priority levels for resource allocation.
/// </summary>
public enum ServicePriority
{
    /// <summary>
    ///     Lowest priority - background analytics and cleanup tasks.
    /// </summary>
    Low = 0,

    /// <summary>
    ///     Normal priority - default for most services.
    /// </summary>
    Normal = 1,

    /// <summary>
    ///     High priority - critical data services that feed the application.
    /// </summary>
    High = 2,

    /// <summary>
    ///     Critical priority - essential services that must run with highest priority.
    /// </summary>
    Critical = 3
}

/// <summary>
///     Wrapper for hosted services that provides priority-based resource allocation.
/// </summary>
public class PriorityHostedService<T> : IHostedService where T : IHostedService
{
    private readonly T _innerService;
    private readonly ILogger<PriorityHostedService<T>> _logger;
    private readonly ServicePriority _priority;
    private readonly string _serviceName;

    public PriorityHostedService(T innerService, ServicePriority priority, ILogger<PriorityHostedService<T>> logger)
    {
        _innerService = innerService;
        _priority = priority;
        _logger = logger;
        _serviceName = typeof(T).Name;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Set process and thread priorities based on service priority
        SetResourcePriority();

        _logger.LogInformation("Starting {ServiceName} with {Priority} priority", _serviceName, _priority);

        await _innerService.StartAsync(cancellationToken);
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping {ServiceName}", _serviceName);
        await _innerService.StopAsync(cancellationToken);
    }

    private void SetResourcePriority()
    {
        try
        {
            var currentProcess = Process.GetCurrentProcess();
            var currentThread = Thread.CurrentThread;

            // Set thread priority based on service priority
            var threadPriority = _priority switch
            {
                ServicePriority.Critical => ThreadPriority.Highest,
                ServicePriority.High => ThreadPriority.AboveNormal,
                ServicePriority.Normal => ThreadPriority.Normal,
                ServicePriority.Low => ThreadPriority.BelowNormal,
                _ => ThreadPriority.Normal
            };

            currentThread.Priority = threadPriority;

            // For high priority services, also adjust process priority if needed
            if (_priority >= ServicePriority.High)
                try
                {
                    // Only increase process priority, never decrease it
                    if (currentProcess.PriorityClass < ProcessPriorityClass.AboveNormal)
                    {
                        currentProcess.PriorityClass = ProcessPriorityClass.AboveNormal;
                        _logger.LogDebug("Elevated process priority for high-priority service {ServiceName}",
                            _serviceName);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Failed to set process priority for {ServiceName}. This may require elevated permissions.",
                        _serviceName);
                }

            _logger.LogDebug("Set thread priority to {ThreadPriority} for {ServiceName}", threadPriority, _serviceName);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to set resource priority for {ServiceName}", _serviceName);
        }
    }
}