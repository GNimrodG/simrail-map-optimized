using MessagePack;
using SMOBackend.Models;
using SMOBackend.Services.ApiClients;
using SMOBackend.Utils;

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

    /// <inheritdoc cref="BaseServerDataService{Nullable{object}}.FetchInterval" />
    protected override TimeSpan FetchInterval => TimeSpan.FromHours(1);

    private protected override TimeSpan DelayBetweenServers => TimeSpan.FromSeconds(1);

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
            new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount },
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

                    await MessagePackSerializer.SerializeAsync(fileStream, timetable, cancellationToken: token).NoContext();

                    await fileStream.FlushAsync(token).NoContext();

                    fileStream.Close();

                    // Rename the file to remove the .temp extension with retry logic
                    var finalFilePath = Path.Combine(serverDirectory, $"{serverCode}-{timetable.TrainNoLocal}.bin");

                    await AtomicFileReplaceAsync(tempFilePath, finalFilePath, token).NoContext();
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to write timetable data for {TrainNoLocal}@{ServerCode}",
                        timetable.TrainNoLocal,
                        serverCode);
                }
            });
    }

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

    /// <summary>
    ///     Atomically replaces a file with retry logic to handle file access conflicts.
    /// </summary>
    /// <param name="tempFilePath">The temporary file path to move from</param>
    /// <param name="finalFilePath">The final file path to move to</param>
    /// <param name="cancellationToken">Cancellation token</param>
    private async Task AtomicFileReplaceAsync(string tempFilePath, string finalFilePath,
        CancellationToken cancellationToken)
    {
        const int maxRetries = 5;
        var baseDelay = TimeSpan.FromMilliseconds(100);

        for (var attempt = 0; attempt <= maxRetries; attempt++)
            try
            {
                // If the target file exists, delete it first
                if (File.Exists(finalFilePath)) File.Delete(finalFilePath);

                // Move the temp file to the final location
                File.Move(tempFilePath, finalFilePath);
                return; // Success
            }
            catch (IOException ex) when (attempt < maxRetries && IsFileInUseError(ex))
            {
                // Calculate exponential backoff delay: 100ms, 200ms, 400ms, 800ms, 1600ms
                var delay = TimeSpan.FromMilliseconds(baseDelay.TotalMilliseconds * Math.Pow(2, attempt));

                logger.LogWarning("File {FilePath} is in use, retrying in {Delay}ms (attempt {Attempt}/{MaxRetries})",
                    finalFilePath, delay.TotalMilliseconds, attempt + 1, maxRetries);

                await Task.Delay(delay, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to move file from {TempPath} to {FinalPath} on attempt {Attempt}",
                    tempFilePath, finalFilePath, attempt + 1);

                // Clean up temp file if it still exists
                try
                {
                    if (File.Exists(tempFilePath)) File.Delete(tempFilePath);
                }
                catch (Exception cleanupEx)
                {
                    logger.LogWarning(cleanupEx, "Failed to clean up temp file {TempPath}", tempFilePath);
                }

                throw;
            }

        // If we get here, all retries failed
        throw new IOException(
            $"Failed to replace file {finalFilePath} after {maxRetries} attempts due to file access conflicts");
    }

    /// <summary>
    ///     Determines if an IOException is caused by the file being in use by another process.
    /// </summary>
    /// <param name="ex">The IOException to check</param>
    /// <returns>True if the error indicates the file is in use</returns>
    private static bool IsFileInUseError(IOException ex)
    {
        const int errorSharingViolation = 0x20;
        const int errorLockViolation = 0x21;

        var hResult = ex.HResult & 0xFFFF;
        return hResult is errorSharingViolation or errorLockViolation;
    }
}