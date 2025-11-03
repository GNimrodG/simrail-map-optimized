using SMOBackend.Models;
using SMOBackend.Utils;

namespace SMOBackend.Services;

/// <summary>
/// Delegate for data received event.
/// </summary>
public record PerServerData<T>(string ServerCode, T Data);

/// <summary>
/// Base class for data services that fetch data for each server.
/// </summary>
public abstract class BaseServerDataService<T>(
    string serviceId,
    ILogger<BaseServerDataService<T>> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService)
    : BaseDataService<Dictionary<string, T>>(serviceId, logger, scopeFactory) where T : class?
{
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
    private readonly string _serviceId = serviceId;

    private protected virtual TimeSpan DelayBetweenServers => TimeSpan.Zero;

    /// <summary>
    ///     The latest data received from the service for a specific server.
    /// </summary>
    public T? this[string serverCode] => Data?[serverCode];

    /// <inheritdoc />
    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        await base.StartAsync(cancellationToken);

        serverDataService.DataReceived += OnServerDataReceived;
    }

    private async void OnServerDataReceived(ServerStatus[] data)
    {
        try
        {
            if (data.Length == 0 || Data == null)
                return;

            var tasks = new List<Task>();

            foreach (var server in data)
            {
                if (Data.ContainsKey(server.ServerCode)) continue;

                logger.LogInformation("Fetching data for new server: {ServerCode}", server.ServerCode);
                var serverCode = server.ServerCode;

                var task = Task.Run(async () =>
                {
                    try
                    {
                        var serverData = await FetchServerData(serverCode, CancellationToken.None).NoContext();
                        lock (Data)
                        {
                            Data[serverCode] = serverData;
                        }

                        OnPerServerDataReceived(new(serverCode, serverData));
                        logger.LogInformation("Data fetched for server: {ServerCode}", serverCode);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Error fetching data for server: {ServerCode}", serverCode);
                    }
                });

                tasks.Add(task);
            }

            if (tasks.Count > 0)
            {
                await Task.WhenAll(tasks);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error processing server data");
        }
    }

    /// <inheritdoc />
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        serverDataService.DataReceived -= OnServerDataReceived;

        await base.StopAsync(cancellationToken);
    }

    /// <summary>
    /// Event that is triggered when new data is received for a specific server.
    /// </summary>
    public event DataReceivedEventHandler<PerServerData<T>>? PerServerDataReceived;

    /// <summary>
    /// Emits an event when data is received for a specific server.
    /// </summary>
    protected virtual void OnPerServerDataReceived(PerServerData<T> data) => PerServerDataReceived?.Invoke(data);

    private protected override Task WriteStats(int time, CancellationToken stoppingToken) =>
        _scopeFactory.LogStat(_serviceId, time, stoppingToken);

    private protected override async Task<Dictionary<string, T>> FetchData(CancellationToken stoppingToken)
    {
        if (serverDataService.Data == null)
        {
            logger.LogWarning("Server data is not available yet, waiting...");
            await serverDataService.FirstDataReceived;
            logger.LogInformation("Server data is now available");
        }

        var result = new Dictionary<string, T>();

        if (DelayBetweenServers == TimeSpan.Zero)
        {
            // Process in parallel
            var fetchTasks = new Dictionary<string, Task<T>>();

            foreach (var server in serverDataService.Data!)
            {
                var serverCode = server.ServerCode;
                var task = FetchServerData(serverCode, stoppingToken)
                    .ContinueWith(t =>
                    {
                        var data = t.Result;
                        // Emit the event when this specific server's data is fetched
                        OnPerServerDataReceived(new(serverCode, data));
                        return data;
                    }, TaskContinuationOptions.OnlyOnRanToCompletion);

                fetchTasks[serverCode] = task;
            }

            await Task.WhenAll(fetchTasks.Values);

            foreach (var (serverCode, task) in fetchTasks)
            {
                result.Add(serverCode, await task);
            }
        }
        else
        {
            // Process sequentially with delay
            foreach (var server in serverDataService.Data!)
            {
                var data = await FetchServerData(server.ServerCode, stoppingToken);
                result.Add(server.ServerCode, data);
                OnPerServerDataReceived(new(server.ServerCode, data));
                await Task.Delay(DelayBetweenServers, stoppingToken);
            }
        }

        return result;
    }

    /// <summary>
    /// Fetch data for a specific server.
    /// </summary>
    /// <param name="serverCode">The server code to fetch data for.</param>
    /// <param name="stoppingToken">The cancellation token.</param>
    protected abstract Task<T> FetchServerData(string serverCode, CancellationToken stoppingToken);
}