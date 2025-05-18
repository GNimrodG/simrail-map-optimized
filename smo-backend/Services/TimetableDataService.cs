using MessagePack;
using SMOBackend.Models;

namespace SMOBackend.Services;

/// <summary>
/// Service for fetching and storing timetable data.
/// </summary>
public class TimetableDataService(
    ILogger<TimetableDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient) : BaseServerDataService<object?>("TIMETABLE", logger, scopeFactory, serverDataService)
{
    private readonly string _dataDirectory = Path.Combine(AppContext.BaseDirectory, "data", "timetables");

    /// <inheritdoc cref="BaseServerDataService{Nullable{object}}.PerServerDataReceived"/>
    public new event DataReceivedEventHandler<PerServerData<Timetable[]>>? PerServerDataReceived;

    /// <inheritdoc />
    public override Task StartAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Starting TimetableDataService...");
        Directory.CreateDirectory(_dataDirectory);

        // remove tmp files that may be left over from previous runs
        foreach (var file in Directory.GetFiles(_dataDirectory, "*.tmp", SearchOption.AllDirectories))
        {
            try
            {
                File.Delete(file);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to delete temporary file {FilePath}", file);
            }
        }

        return base.StartAsync(stoppingToken);
    }

    private async Task WriteData(string serverCode, Timetable[] timetables)
    {
        var serverDirectory = Path.Combine(_dataDirectory, serverCode);
        Directory.CreateDirectory(serverDirectory);

        logger.LogInformation("Writing data to {ServerDirectory}", serverDirectory);

        await Parallel.ForEachAsync(
            timetables,
            new ParallelOptions { MaxDegreeOfParallelism = 16 },
            async (timetable, token) =>
            {
                var tempFilePath = Path.Combine(serverDirectory, $"{serverCode}-{timetable.TrainNoLocal}.bin.tmp");

                try
                {
                    await using var fileStream = new FileStream(
                        tempFilePath,
                        FileMode.Create,
                        FileAccess.Write,
                        FileShare.None,
                        bufferSize: 4096,
                        useAsync: true);

                    await MessagePackSerializer.SerializeAsync(fileStream, timetable, cancellationToken: token);

                    await fileStream.FlushAsync(token);

                    fileStream.Close();

                    // Rename the file to remove the .temp extension
                    var finalFilePath = Path.Combine(serverDirectory, $"{serverCode}-{timetable.TrainNoLocal}.bin");

                    if (File.Exists(finalFilePath)) File.Delete(finalFilePath);
                    File.Move(tempFilePath, finalFilePath);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to write timetable data for {TrainNoLocal}@{ServerCode}",
                        timetable.TrainNoLocal,
                        serverCode);
                }
            });
    }

    /// <inheritdoc cref="BaseServerDataService{Nullable{object}}.FetchInterval"/>
    protected override TimeSpan FetchInterval => TimeSpan.FromHours(1);

    private protected override TimeSpan DelayBetweenServers => TimeSpan.FromSeconds(1);

    /// <inheritdoc cref="BaseServerDataService{Nullable{object}}.FetchServerData"/>
    protected override async Task<object?> FetchServerData(string serverCode,
        CancellationToken stoppingToken)
    {
        try
        {
            var timetables = await apiClient.GetAllTimetablesAsync(serverCode, stoppingToken);

            if (timetables == null)
            {
                throw new("Failed to fetch timetable data");
            }

            await WriteData(serverCode, timetables);
            PerServerDataReceived?.Invoke(new(serverCode, timetables));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch timetable data for {ServerCode}", serverCode);
            throw;
        }

        return null;
    }

    /// <summary>
    /// Gets the timetable for a specific train, identified by its local number.
    /// </summary>
    public async Task<Timetable?> GetTimetableForTrainAsync(string serverCode, string trainNoLocal,
        CancellationToken stoppingToken = default)
    {
        var filePath = Path.Combine(_dataDirectory, serverCode, $"{serverCode}-{trainNoLocal}.bin");

        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            // Use FileStream with useAsync: true parameter for truly async I/O
            await using FileStream fileStream = new(
                filePath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                bufferSize: 4096,
                useAsync: true);

            return await MessagePackSerializer.DeserializeAsync<Timetable>(fileStream,
                cancellationToken: stoppingToken);
        }
        catch (IOException ex)
        {
            logger.LogError(ex, "Failed to read timetable data for {TrainNoLocal}@{ServerCode}", trainNoLocal,
                serverCode);
            return null;
        }
        catch (MessagePackSerializationException ex)
        {
            logger.LogError("Failed to deserialize timetable data for {TrainNoLocal}@{ServerCode}: {Message}",
                trainNoLocal,
                serverCode,
                ex.Message);

            try
            {
                File.Delete(filePath);
                logger.LogWarning("Deleted corrupted file {FilePath}", filePath);
            }
            catch (Exception deleteEx)
            {
                logger.LogError(deleteEx, "Failed to delete corrupted file {FilePath}", filePath);
            }

            return null;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to read timetable data for {TrainNoLocal}@{ServerCode}", trainNoLocal,
                serverCode);

            return null;
        }
    }
}