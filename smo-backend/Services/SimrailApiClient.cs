using System.Net.Sockets;
using Newtonsoft.Json;
using SMOBackend.Models;
using SMOBackend.Models.Entity;
using SMOBackend.Models.Trains;

namespace SMOBackend.Services;

/// <summary>
///     Response wrapper that includes Age header information for cache alignment
/// </summary>
public class ApiResponseWithAge<T>
{
    /// <summary>
    ///     Initializes a new instance of the <see cref="ApiResponseWithAge{T}" /> class.
    /// </summary>
    public ApiResponseWithAge(T data, TimeSpan? age, DateTime? responseDate)
    {
        Data = data;
        Age = age;
        ResponseDate = responseDate;
    }

    /// <summary>
    ///     The data returned by the API.
    /// </summary>
    public T Data { get; }

    /// <summary>
    ///     The age of the response, as provided by the Age header.
    /// </summary>
    public TimeSpan? Age { get; }

    /// <summary>
    ///     The date and time when the response was generated, as provided by the Date header.
    /// </summary>
    public DateTime? ResponseDate { get; }
}

/// <summary>
/// Exception thrown when the SimRail API is temporarily unavailable
/// </summary>
public class SimrailApiTemporarilyUnavailableException : Exception
{
    /// <summary>
    ///     Initializes a new instance of the <see cref="SimrailApiTemporarilyUnavailableException" /> class.
    /// </summary>
    /// <param name="message">The error message that explains the reason for the exception.</param>
    /// <param name="innerException">The exception that is the cause of the current exception.</param>
    public SimrailApiTemporarilyUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

/// <summary>
///     A client for the Simrail API with robust error handling and retry logic.
/// </summary>
public class SimrailApiClient : IDisposable
{
    private const string ServersOpenUrl = "https://panel.simrail.eu:8084/servers-open";
    private const string TrainsUrlPrefix = "https://panel.simrail.eu:8084/trains-open?serverCode=";
    private const string TrainPositionsUrlPrefix = "https://panel.simrail.eu:8084/train-positions-open?serverCode=";
    private const string StationsUrlPrefix = "https://panel.simrail.eu:8084/stations-open?serverCode=";
    private const string TimezoneUrlPrefix = "https://api.simrail.eu:8082/api/getTimeZone?serverCode=";
    private const string TimeUrlPrefix = "https://api.simrail.eu:8082/api/getTime?serverCode=";
    private const string TimetableUrlPrefix = "https://api.simrail.eu:8082/api/getAllTimetables?serverCode=";
    private const string EdrTimetableUrlPrefix = "https://api1.aws.simrail.eu:8082/api/getEDRTimetables?serverCode=";
    private readonly TimeSpan _baseRetryDelay;

    private readonly HttpClient _httpClient;
    private readonly ILogger<SimrailApiClient> _logger;
    private readonly int _maxRetries;

    /// <summary>
    ///     Initializes a new instance of the <see cref="SimrailApiClient" /> class with retry configuration.
    /// </summary>
    /// <param name="logger">The logger instance for logging API operations and errors.</param>
    /// <param name="maxRetries">The maximum number of retry attempts for failed requests. Default is 3.</param>
    /// <param name="baseRetryDelay">The base delay between retry attempts. Default is 2 seconds. Uses exponential backoff.</param>
    public SimrailApiClient(ILogger<SimrailApiClient> logger, int maxRetries = 3, TimeSpan? baseRetryDelay = null)
    {
        _logger = logger;
        _maxRetries = maxRetries;
        _baseRetryDelay = baseRetryDelay ?? TimeSpan.FromSeconds(2);

        _httpClient = new();
        _httpClient.Timeout = TimeSpan.FromSeconds(30); // Set reasonable timeout
    }

    /// <summary>
    ///     Releases all resources used by the <see cref="SimrailApiClient" />.
    /// </summary>
    public void Dispose()
    {
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    ///     Executes an HTTP operation with retry logic and exponential backoff for transient failures.
    /// </summary>
    /// <param name="operation">The HTTP operation to execute.</param>
    /// <param name="operationName">A descriptive name for the operation used in logging.</param>
    /// <param name="cancellationToken">The cancellation token to observe.</param>
    /// <returns>The HTTP response message if successful.</returns>
    /// <exception cref="SimrailApiTemporarilyUnavailableException">Thrown when all retry attempts are exhausted.</exception>
    /// <exception cref="OperationCanceledException">Thrown when the operation is cancelled.</exception>
    private async Task<HttpResponseMessage> ExecuteWithRetryAsync(
        Func<CancellationToken, Task<HttpResponseMessage>> operation,
        string operationName,
        CancellationToken cancellationToken)
    {
        Exception? lastException = null;

        for (var attempt = 0; attempt <= _maxRetries; attempt++)
            try
            {
                if (attempt > 0)
                {
                    var delay = TimeSpan.FromMilliseconds(_baseRetryDelay.TotalMilliseconds * Math.Pow(2, attempt - 1));
                    _logger.LogWarning(
                        "Retrying {OperationName} (attempt {Attempt}/{MaxRetries}) after {Delay}ms delay",
                        operationName, attempt + 1, _maxRetries + 1, delay.TotalMilliseconds);

                    await Task.Delay(delay, cancellationToken);
                }

                var response = await operation(cancellationToken);

                if (attempt > 0)
                    _logger.LogInformation("Successfully recovered {OperationName} after {Attempt} retries",
                        operationName, attempt);

                return response;
            }
            catch (Exception ex) when (IsRetriableException(ex) && attempt < _maxRetries)
            {
                lastException = ex;
                _logger.LogWarning(ex, "Attempt {Attempt}/{MaxRetries} failed for {OperationName}: {Message}",
                    attempt + 1, _maxRetries + 1, operationName, ex.Message);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation("{OperationName} was cancelled", operationName);
                throw;
            }
            catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation("{OperationName} was cancelled", operationName);
                throw;
            }

        // All retries exhausted
        var message = $"All {_maxRetries + 1} attempts failed for {operationName}";
        _logger.LogError(lastException, "All {MaxRetries} attempts failed for {OperationName}", _maxRetries + 1,
            operationName);

        throw new SimrailApiTemporarilyUnavailableException(message, lastException!);
    }

    /// <summary>
    ///     Determines if an exception is retriable based on its type and characteristics.
    /// </summary>
    /// <param name="ex">The exception to evaluate.</param>
    /// <returns>True if the exception represents a transient failure that can be retried; otherwise, false.</returns>
    private static bool IsRetriableException(Exception ex)
    {
        return ex switch
        {
            SocketException socketEx => socketEx.SocketErrorCode is
                SocketError.ConnectionRefused or
                SocketError.TimedOut or
                SocketError.NetworkUnreachable or
                SocketError.HostUnreachable,
            HttpRequestException httpEx => httpEx.Message.Contains("Connection refused") ||
                                           httpEx.Message.Contains("timeout") ||
                                           httpEx.Message.Contains("network"),
            TaskCanceledException => true, // Timeout
            _ => false
        };
    }

    /// <summary>
    ///     Handles a HTTP response and extracts the data array from the SimRail API response format.
    /// </summary>
    /// <typeparam name="T">The type of objects in the response array.</typeparam>
    /// <param name="response">The HTTP response message to process.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An array of deserialized objects from the API response.</returns>
    private static async Task<T[]> HandleResponse<T>(HttpResponseMessage response, CancellationToken stoppingToken)
        where T : class
    {
        var responseWithAge = await HandleResponseWithAge<T>(response, stoppingToken);
        return responseWithAge.Data;
    }

    /// <summary>
    ///     Handles an HTTP response and extracts both the data array and Age header information from the SimRail API response.
    /// </summary>
    /// <typeparam name="T">The type of objects in the response array.</typeparam>
    /// <param name="response">The HTTP response message to process.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An ApiResponseWithAge containing the data array and cache timing information.</returns>
    private static async Task<ApiResponseWithAge<T[]>> HandleResponseWithAge<T>(HttpResponseMessage response,
        CancellationToken stoppingToken)
        where T : class
    {
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(stoppingToken);
        using var reader = new StreamReader(stream);
        await using var jsonReader = new JsonTextReader(reader);

        var serializer = new JsonSerializer();
        var result = serializer.Deserialize<BaseListResponse<T>>(jsonReader);

        if (result == null)
        {
            throw new("Response is null");
        }

        if (!result.Result)
        {
            throw new(result.Description);
        }

        var responseWithAge =
            new ApiResponseWithAge<T[]>(result.Data, response.Headers.Age, response.Headers.Date?.UtcDateTime);

        if (response.Headers.Date == null || response.Headers.Age == null || result.Data.Length <= 0 ||
            result.Data[0] is not IEntityWithTimestamp) return responseWithAge;

        foreach (var item in result.Data)
        {
            ((IEntityWithTimestamp)item).Timestamp =
                response.Headers.Date!.Value.UtcDateTime - response.Headers.Age!.Value;
        }

        return responseWithAge;
    }

    /// <summary>
    /// Get the list of all servers.
    /// </summary>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An array of server status information.</returns>
    public async Task<ServerStatus[]> GetServersAsync(CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(ServersOpenUrl, ct),
            "GetServers",
            stoppingToken);
        return await HandleResponse<ServerStatus>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all trains on a server.
    /// </summary>
    /// <param name="serverCode">The server code to query for train information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An array of train information for the specified server.</returns>
    public async Task<Train[]> GetTrainsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(TrainsUrlPrefix + serverCode, ct),
            $"GetTrains({serverCode})",
            stoppingToken);
        return await HandleResponse<Train>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all train positions on a server.
    /// </summary>
    /// <param name="serverCode">The server code to query for train position information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An array of train position information for the specified server.</returns>
    public async Task<TrainPosition[]> GetTrainPositionsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(TrainPositionsUrlPrefix + serverCode, ct),
            $"GetTrainPositions({serverCode})",
            stoppingToken);
        return await HandleResponse<TrainPosition>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all stations on a server.
    /// </summary>
    /// <param name="serverCode">The server code to query for station information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An array of station information for the specified server.</returns>
    public async Task<Station[]> GetStationsAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(StationsUrlPrefix + serverCode, ct),
            $"GetStations({serverCode})",
            stoppingToken);
        return await HandleResponse<Station>(response, stoppingToken);
    }

    /// <summary>
    /// Get the unix epoch time of the server and the date of the response.
    /// </summary>
    /// <param name="serverCode">The server code to query for time information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>A tuple containing the server time in unix epoch format and the response date, or null if parsing failed.</returns>
    public async Task<(long time, DateTime date)?> GetTimeAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(TimeUrlPrefix + serverCode, ct),
            $"GetTime({serverCode})",
            stoppingToken);

        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        if (long.TryParse(content, out var time)) return (time, response.Headers.Date!.Value.DateTime);

        throw new(content);
    }

    /// <summary>
    /// Get the timezone offset of the server in hours.
    /// </summary>
    /// <param name="serverCode">The server code to query for timezone information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>The timezone offset in hours, or null if parsing failed.</returns>
    public async Task<int?> GetTimezoneAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(TimezoneUrlPrefix + serverCode, ct),
            $"GetTimezone({serverCode})",
            stoppingToken);

        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync(stoppingToken);
        return int.TryParse(content, out var timezone) ? timezone : null;
    }

    /// <summary>
    /// Get the list of all timetables on a server.
    /// </summary>
    /// <param name="serverCode">The server code to query for timetable information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An array of timetable information for the specified server.</returns>
    public async Task<Timetable[]> GetAllTimetablesAsync(string serverCode, CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(TimetableUrlPrefix + serverCode, ct),
            $"GetAllTimetables({serverCode})",
            stoppingToken);

        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(stoppingToken);
        using var reader = new StreamReader(stream);
        await using var jsonReader = new JsonTextReader(reader);

        var serializer = new JsonSerializer();
        var result = serializer.Deserialize<Timetable[]>(jsonReader);

        if (result == null)
        {
            throw new("Response is null");
        }

        return result;
    }

    /// <summary>
    /// Get the list of all EDR timetables on a server.
    /// </summary>
    /// <param name="serverCode">The server code to query for EDR timetable information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An array of EDR timetable entries for the specified server.</returns>
    public async Task<EdrTimetableTrainEntry[]> GetEdrTimetablesAsync(string serverCode,
        CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(EdrTimetableUrlPrefix + serverCode, ct),
            $"GetEdrTimetables({serverCode})",
            stoppingToken);

        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(stoppingToken);
        using var reader = new StreamReader(stream);
        await using var jsonReader = new JsonTextReader(reader);

        var serializer = new JsonSerializer();
        var result = serializer.Deserialize<EdrTimetableTrainEntry[]>(jsonReader);

        if (result == null)
        {
            throw new("Response is null");
        }

        return result;
    }

    /// <summary>
    /// Get the list of all servers with Age header information.
    /// </summary>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An ApiResponseWithAge containing server status information and cache timing data.</returns>
    public async Task<ApiResponseWithAge<ServerStatus[]>> GetServersWithAgeAsync(CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(ServersOpenUrl, ct),
            "GetServersWithAge",
            stoppingToken);
        return await HandleResponseWithAge<ServerStatus>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all trains on a server with Age header information.
    /// </summary>
    /// <param name="serverCode">The server code to query for train information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An ApiResponseWithAge containing train information and cache timing data.</returns>
    public async Task<ApiResponseWithAge<Train[]>> GetTrainsWithAgeAsync(string serverCode,
        CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(TrainsUrlPrefix + serverCode, ct),
            $"GetTrainsWithAge({serverCode})",
            stoppingToken);
        return await HandleResponseWithAge<Train>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all train positions on a server with Age header information.
    /// </summary>
    /// <param name="serverCode">The server code to query for train position information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An ApiResponseWithAge containing train position information and cache timing data.</returns>
    public async Task<ApiResponseWithAge<TrainPosition[]>> GetTrainPositionsWithAgeAsync(string serverCode,
        CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(TrainPositionsUrlPrefix + serverCode, ct),
            $"GetTrainPositionsWithAge({serverCode})",
            stoppingToken);
        return await HandleResponseWithAge<TrainPosition>(response, stoppingToken);
    }

    /// <summary>
    /// Get the list of all stations on a server with Age header information.
    /// </summary>
    /// <param name="serverCode">The server code to query for station information.</param>
    /// <param name="stoppingToken">The cancellation token to observe.</param>
    /// <returns>An ApiResponseWithAge containing station information and cache timing data.</returns>
    public async Task<ApiResponseWithAge<Station[]>> GetStationsWithAgeAsync(string serverCode,
        CancellationToken stoppingToken)
    {
        var response = await ExecuteWithRetryAsync(
            ct => _httpClient.GetAsync(StationsUrlPrefix + serverCode, ct),
            $"GetStationsWithAge({serverCode})",
            stoppingToken);
        return await HandleResponseWithAge<Station>(response, stoppingToken);
    }
}