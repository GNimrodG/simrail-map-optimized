using Prometheus;

namespace SMOBackend.Utils;

/// <summary>
/// A thread-safe queue processor that processes items in parallel.
/// </summary>
/// <param name="logger">The logger to use for logging.</param>
/// <param name="processItem">The function to process each item.</param>
/// <param name="gauge">The Prometheus gauge to track the queue size.</param>
/// <param name="maxDegreeOfParallelism"> The maximum number of items to process in parallel.</param>
/// <param name="maxQueueSize"> The maximum size of the queue.</param>
/// <typeparam name="T">The type of items to be processed.</typeparam>
public class QueueProcessor<T>(
    ILogger logger,
    Func<T, Task> processItem,
    Gauge gauge,
    int maxDegreeOfParallelism = 1,
    int maxQueueSize = 3)
    : IDisposable
{
    private readonly SemaphoreSlim _processingLock = new(maxDegreeOfParallelism, maxDegreeOfParallelism);
    private readonly Queue<T> _dataQueue = new();

    /// <summary>
    /// Enqueues data for processing. If the queue is full, the oldest item will be removed to make space for the new data.
    /// </summary>
    /// <param name="data">The data to be processed.</param>
    public async void Enqueue(T data)
    {
        try
        {
            lock (_dataQueue)
            {
                // If queue is at maximum capacity, remove the oldest item
                if (_dataQueue.Count >= maxQueueSize)
                {
                    _dataQueue.Dequeue(); // Remove the oldest item to make space for newest data
                    logger.LogWarning("Queue full, removed the oldest item to make room for newest data");
                }

                _dataQueue.Enqueue(data);
                logger.LogInformation(
                    "Data queued for processing. Queue length: {QueueLength}/{MaxQueueSize}",
                    _dataQueue.Count, maxQueueSize);
                gauge.Set(_dataQueue.Count);
            }

            // Try to acquire the lock non-blocking-ly
            // If we couldn't get the lock, simply return as the data is already in the queue
            // and will be processed when the current processing finishes
            if (!await _processingLock.WaitAsync(0)) return;

            try
            {
                // Process the queue
                await ProcessQueuedData();
                _processingLock.Release();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing data");
                _processingLock.Release();
            }
        }
        catch (Exception ex)
        {
            logger.LogCritical(ex, "Error processing data");
        }
    }

    private async Task ProcessQueuedData()
    {
        while (true)
        {
            T? nextData;

            lock (_dataQueue)
            {
                if (_dataQueue.Count == 0)
                    return;

                nextData = _dataQueue.Dequeue();
                logger.LogInformation("Processing queued data. Remaining queue length: {QueueLength}/{MaxQueueSize}",
                    _dataQueue.Count, maxQueueSize);
                gauge.Set(_dataQueue.Count);
            }

            try
            {
                await processItem(nextData);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing queued data: {Data}", nextData);
            }
        }
    }

    /// <summary>
    /// Clears the queue and resets the gauge.
    /// </summary>
    public void ClearQueue()
    {
        lock (_dataQueue)
        {
            _dataQueue.Clear();
            logger.LogInformation("Cleared the queue");
            gauge.Set(0);
        }
    }

    /// <inheritdoc cref="IDisposable.Dispose"/>
    public void Dispose()
    {
        ClearQueue();
        _processingLock.Dispose();
        GC.SuppressFinalize(this);
    }
}