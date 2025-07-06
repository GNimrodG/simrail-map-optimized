namespace SMOBackend.Services;

/// <summary>
///     Base class for data services that fetch time-aligned data.
/// </summary>
public abstract class BaseTimeAlignedDataService<T>(
    string serviceId,
    ILogger<BaseTimeAlignedDataService<T>> logger,
    IServiceScopeFactory scopeFactory)
    : BaseDataService<ApiResponseWithAge<T>>(serviceId, logger, scopeFactory) where T : class?
{
    /// <inheritdoc cref="BaseDataService{T}.Data" />
    public new T? Data { get; private set; }

    /// <inheritdoc cref="BaseDataService{T}.DataReceived" />
    public new event DataReceivedEventHandler<T>? DataReceived;

    private protected override async Task ExecuteService(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(GetFetchInterval());

        try
        {
            do
            {
                await GetValue(stoppingToken);
                logger.LogInformation("{ServiceId} service executed successfully", ServiceId);
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

    private async Task GetValue(CancellationToken stoppingToken)
    {
        try
        {
            var start = DateTime.Now;

            var data = await FetchData(stoppingToken);

            var elapsed = (int)(DateTime.Now - start).TotalMilliseconds;

            logger.LogInformation("{ServiceId} fetched in {Elapsed}ms", ServiceId, elapsed);

            Data = data.Data;

            OnDataReceived(data.Data);

            // Signal that the first data has been received
            if (!FirstDataReceivedSource.Task.IsCompleted)
                FirstDataReceivedSource.SetResult();

            await WriteStats(elapsed, stoppingToken);
            LastFetch = DateTime.UtcNow;

            if (data.Age.HasValue)
            {
                if (data.Age.Value > GetFetchInterval())
                {
                    logger.LogWarning("{ServiceId} data age is {Age}s, which exceeds the fetch interval of {Interval}s",
                        ServiceId, data.Age.Value.TotalSeconds, GetFetchInterval().TotalSeconds);
                }
                else if (data.Age.Value.TotalSeconds != 0 && data.Age.Value < GetFetchInterval())
                {
                    var shouldRefetchIn = GetFetchInterval() - data.Age.Value;

                    shouldRefetchIn = shouldRefetchIn.Subtract(TimeSpan.FromMilliseconds(elapsed));

                    logger.LogInformation("{ServiceId} data age is {Age}s, refetching in {ShouldRefetchIn}s",
                        ServiceId, data.Age.Value.TotalSeconds, shouldRefetchIn.TotalSeconds);

                    await Task.Delay(shouldRefetchIn, stoppingToken);
                    await GetValue(stoppingToken);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Data service stopped by cancellation token");
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
    }

    /// <summary>
    ///     Emits an event when data is received.
    /// </summary>
    protected virtual void OnDataReceived(T data)
    {
        if (data == null) return;
        DataReceived?.Invoke(data);
    }
}