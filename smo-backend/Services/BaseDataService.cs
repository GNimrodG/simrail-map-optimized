using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
/// Delegate for data received event.
/// </summary>
public delegate void DataReceivedEventHandler<in T>(T data);

/// <summary>
/// Base class for data services.
/// </summary>
public abstract class BaseDataService<T>(
    string serviceId,
    ILogger<BaseDataService<T>> logger,
    IServiceScopeFactory scopeFactory)
    : IHostedService, IDataService where T : class?
{
    private protected readonly TaskCompletionSource FirstDataReceivedSource = new();

    private CancellationTokenSource? _cancellationTokenSource;
    private Task? _dataServiceTask;

    private protected int RunCount;

    /// <summary>
    ///     The interval at which the data is fetched.
    /// </summary>
    protected abstract TimeSpan FetchInterval { get; }

    /// <summary>
    /// The latest data received from the service.
    /// </summary>
    public T? Data { get; protected set; }

    /// <summary>
    /// Task that is completed when the first data is received.
    /// </summary>
    public Task FirstDataReceived => FirstDataReceivedSource.Task;

    /// <inheritdoc />
    public string ServiceId => serviceId;

    /// <inheritdoc />
    public DateTime LastFetch { get; private protected set; } = DateTime.MinValue;

    /// <inheritdoc />
    public TimeSpan GetFetchInterval()
    {
        var envSetting = Environment.GetEnvironmentVariable($"{serviceId}_REFRESH_INTERVAL");
        if (string.IsNullOrEmpty(envSetting)) return FetchInterval;

        if (int.TryParse(envSetting, out var intervalInSeconds))
            return TimeSpan.FromSeconds(intervalInSeconds);


        return TimeSpan.TryParse(envSetting, out var interval) ? interval : FetchInterval;
    }

    /// <inheritdoc />
    public virtual Task StartAsync(CancellationToken cancellationToken)
    {
        Thread.CurrentThread.Name = serviceId;
        logger.BeginScope("[{ServiceId}]", serviceId);
        logger.LogInformation("Starting {ServiceId} service with {FetchInterval}s interval", serviceId,
            GetFetchInterval().TotalSeconds);

        _cancellationTokenSource = new();

        _dataServiceTask = Task.Run(() => ExecuteService(_cancellationTokenSource.Token), cancellationToken)
            .ContinueWith(t =>
            {
                if (t.IsFaulted)
                {
                    logger.LogCritical(t.Exception, "Data service failed");
                }
            }, TaskContinuationOptions.OnlyOnFaulted)
            .ContinueWith(t =>
            {
                if (t.IsCanceled)
                {
                    logger.LogWarning("Data service was canceled");
                }
            }, TaskContinuationOptions.OnlyOnCanceled);

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public virtual Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogWarning("Stopping {ServiceId} service", serviceId);

        _cancellationTokenSource?.Cancel();

        return _dataServiceTask ?? Task.CompletedTask;
    }

    /// <summary>
    ///     Event that is triggered when new data is received.
    /// </summary>
    public event DataReceivedEventHandler<T>? DataReceived;

    private protected virtual async Task ExecuteService(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(GetFetchInterval());

        try
        {
            do
            {
                try
                {
                    var start = DateTime.Now;

                    var data = await FetchData(stoppingToken);

                    var elapsed = (int)(DateTime.Now - start).TotalMilliseconds;

                    if (data == null)
                    {
                        logger.LogWarning("Failed to fetch data in {Elapsed}ms", elapsed);
                        continue;
                    }

                    logger.LogInformation("{ServiceId} fetched in {Elapsed}ms", serviceId, elapsed);

                    Data = data;

                    OnDataReceived(data);

                    // Signal that the first data has been received
                    if (!FirstDataReceivedSource.Task.IsCompleted)
                        FirstDataReceivedSource.SetResult();

                    await WriteStats(elapsed, stoppingToken);
                    LastFetch = DateTime.UtcNow;
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    logger.LogInformation("Data service stopped by cancellation token");
                    return;
                }
                catch (HttpRequestException e)
                {
                    logger.LogWarning("Failed to fetch data due to HTTP error: {Message}", e.Message);
                }
                catch (TaskCanceledException e) when (e.InnerException is TimeoutException)
                {
                    logger.LogWarning("Data fetch timed out: {Message}", e.Message);
                }
                catch (TaskCanceledException e)
                {
                    logger.LogWarning(e, "Data fetch was canceled");
                }
                catch (Exception e)
                {
                    logger.LogError(e, "Failed to fetch data");
                }
            } while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (Exception e)
        {
            logger.LogCritical(e, "Data service failed!");
        }

        if (!stoppingToken.IsCancellationRequested)
        {
            logger.LogError("Data service was stopped unexpectedly, restarting...");
            await Task.Delay(1000, stoppingToken);
            await ExecuteService(stoppingToken);
        }
    }

    private protected virtual Task WriteStats(int time, CancellationToken stoppingToken) =>
        scopeFactory.LogStat(serviceId, time, ++RunCount, null, stoppingToken);

    private protected abstract Task<T> FetchData(CancellationToken stoppingToken);

    /// <summary>
    ///     Emits an event when data is received.
    /// </summary>
    protected virtual void OnDataReceived(T data)
    {
        if (data == null) return;
        DataReceived?.Invoke(data);
    }
}