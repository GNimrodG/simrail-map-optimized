using System.Text.Json;
using Marvin.Cache.Headers;
using Microsoft.AspNetCore.Mvc;
using SMOBackend.Analytics;
using SMOBackend.Models;
using SMOBackend.Models.Trains;
using SMOBackend.Services;
using SMOBackend.Utils;

// ReSharper disable RouteTemplates.ParameterTypeCanBeMadeStricter

namespace SMOBackend.Controllers;

[ApiController]
[Route("status")]
[Produces("application/json")]
public class StatusController(
    ClientManagerService clientManagerService,
    ServerDataService serverDataService,
    TrainDataService trainDataService,
    TimetableDataService timetableDataService,
    StationDataService stationDataService,
    TimeDataService timeDataService,
    TrainDelayAnalyzerService delayAnalyzerService,
    TimetableAnalyzerService timetableAnalyzerService,
    RoutePointAnalyzerService routePointAnalyzerService,
    ServerRestartAnalyzerService serverRestartAnalyzerService,
    StationAnalyzerService stationAnalyzerService
) : ControllerBase
{
    private static bool ValidatePassword(string? password) =>
        !string.IsNullOrWhiteSpace(StdUtils.GetEnvVar("ADMIN_PASSWORD", "")) &&
        StdUtils.GetEnvVar("ADMIN_PASSWORD", "") == password;

    /// <summary>
    /// Get the status of the server
    /// </summary>
    [HttpGet(Name = "GetStatus")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<StatusResponse> GetStatus()
    {
        return Ok(new StatusResponse(clientManagerService.ConnectionCount,
            serverDataService.Data?.ToDictionary(server => server.ServerCode,
                server => clientManagerService.SelectedServers.Count(x => x.Value == server.ServerCode)),
            serverDataService.Data
        ));
    }

    /// <summary>
    /// Get all unique stations from all servers
    /// </summary>
    [HttpGet("stations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<Station[]> GetAllStations([FromQuery] bool includeDispatchedBy = false)
    {
        if (serverDataService.Data == null)
            return NotFound(new NotFoundError("Server data not found", "server_data_not_found"));

        var stations = serverDataService.Data
            .SelectMany(server => stationDataService[server.ServerCode] ?? [])
            .GroupBy(station => station.Name)
            .Select(group =>
            {
                var clone = JsonSerializer.Deserialize<Station>(JsonSerializer.Serialize(group.First()));

                if (clone == null)
                    throw new("Failed to clone station");

                clone.DispatchedBy =
                    includeDispatchedBy ? group.SelectMany(station => station.DispatchedBy).ToArray() : [];

                return clone;
            })
            .ToArray();

        return Ok(stations);
    }

    private bool CheckServer(string serverCode)
    {
        return serverDataService.Data?.Any(x => x.ServerCode == serverCode) ?? false;
    }

    // TODO: server delays

    /// <summary>
    /// Get the list of trains for a specific server
    /// </summary>
    /// <param name="serverCode">The server code</param>
    [HttpGet("{serverCode}/trains", Name = "GetServerTrains")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<Train[]> GetServerTrains(string serverCode)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        var trains = trainDataService[serverCode];

        return Ok(trains ?? []);
    }

    private bool CheckTrain(string serverCode, string trainNoLocal) =>
        trainDataService[serverCode]?.Any(x => x.TrainNoLocal == trainNoLocal) ?? false;

    /// <summary>
    /// Get a specific train for a specific server
    /// </summary>
    /// <param name="serverCode">The server code</param>
    /// <param name="trainNoLocal">The local train number</param>
    [HttpGet("{serverCode}/trains/{trainNoLocal:int:min(1000)}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<Train> GetTrain(string serverCode, string trainNoLocal)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        if (!CheckTrain(serverCode, trainNoLocal))
            return NotFound(new NotFoundError("Train not found", "train_not_found"));

        var train = trainDataService[serverCode]!.FirstOrDefault(x => x.TrainNoLocal == trainNoLocal);

        return train == null ? NotFound() : Ok(train);
    }

    /// <summary>
    /// Get the list of delays for a specific train
    /// </summary>
    /// <param name="serverCode">The server code</param>
    /// <param name="trainNoLocal">The local train number</param>
    [HttpGet("{serverCode}/trains/{trainNoLocal:int:min(1000)}/delays")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<Dictionary<int, int>> GetTrainDelays(string serverCode, string trainNoLocal)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        if (!CheckTrain(serverCode, trainNoLocal))
            return NotFound(new NotFoundError("Train not found", "train_not_found"));

        var delays = delayAnalyzerService.GetDelaysForTrain(trainDataService[serverCode]!
            .FirstOrDefault(x => x.TrainNoLocal == trainNoLocal)!);

        return Ok(delays);
    }

    /// <summary>
    /// Get the timetable for a specific train
    /// </summary>
    /// <param name="serverCode">The server code</param>
    /// <param name="trainNoLocal">The local train number</param>
    [HttpGet("{serverCode}/trains/{trainNoLocal:int:min(1000)}/timetable")]
    [HttpCacheExpiration(CacheLocation = CacheLocation.Public, MaxAge = 3600)] // 1 hour, same as TimetableDataService.FetchInterval
    [HttpCacheValidation(MustRevalidate = false, ProxyRevalidate = true)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public async Task<ActionResult<Timetable>> GetTrainTimetable(string serverCode, string trainNoLocal)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        var timetable = await timetableDataService.GetTimetableForTrainAsync(serverCode, trainNoLocal);

        return timetable == null
            ? NotFound(new NotFoundError("Timetable not found", "timetable_not_found"))
            : Ok(timetable);
    }

    /// <summary>
    /// Get the list of stations for a specific server
    /// </summary>
    /// <param name="serverCode">The server code</param>
    [HttpGet("{serverCode}/stations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<Station[]> GetServerStations(string serverCode)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        var stations = stationDataService[serverCode];

        return Ok(stations ?? []);
    }

    private bool CheckStation(string serverCode, string stationName) =>
        stationDataService[serverCode]?.Any(x => x.Name == stationName) ?? false;

    /// <summary>
    /// Get a specific station for a specific server
    /// </summary>
    /// <param name="serverCode">The server code</param>
    /// <param name="stationName">The station prefix</param>
    [HttpGet("{serverCode}/stations/{stationName}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<Station> GetStation(string serverCode, string stationName)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        if (!CheckStation(serverCode, stationName))
            return NotFound(new NotFoundError("Station not found", "station_not_found"));

        var station = stationDataService[serverCode]!.FirstOrDefault(x => x.Name == stationName);

        return Ok(station);
    }

    /// <summary>
    /// Get the timetable entries for a specific station
    /// </summary>
    /// <param name="serverCode">The server code</param>
    /// <param name="stationName">The station prefix</param>
    [HttpGet("{serverCode}/stations/{stationName}/timetable")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<SimplifiedTimetableEntry[]> GetStationTimetable(string serverCode, string stationName)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        var timetable = timetableAnalyzerService.GetTimetableEntries(serverCode, stationName);

        return Ok(timetable);
    }

    /// <summary>
    /// The time data for a specific server
    /// </summary>
    /// <param name="serverCode">The server code</param>
    [HttpGet("{serverCode}/time")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<TimeData> GetServerTime(string serverCode)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        var time = timeDataService[serverCode];

        return time == null ? NotFound(new NotFoundError("Time data not found", "time_data_not_found")) : Ok(time);
    }

    /// <summary>
    /// Get the list of delays for a specific server
    /// </summary>
    /// <param name="serverCode">The server code</param>
    /// <returns>Dictionary of train numbers and their latest delays</returns>
    [HttpGet("{serverCode}/delays")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<Dictionary<string, int>> GetServerDelays(string serverCode)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        var delays = delayAnalyzerService.GetDelaysForTrains(trainDataService[serverCode]!)
            .ToDictionary(x => x.Key, x => x.Value.Values.LastOrDefault());

        return Ok(delays);
    }

    [HttpGet("{serverCode}/restarts")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(NotFoundError))]
    public ActionResult<ServerRestartStatusData> GetServerRestarts(string serverCode)
    {
        if (!CheckServer(serverCode))
            return NotFound(new NotFoundError("Server not found", "server_not_found"));

        var restartData = serverRestartAnalyzerService.GetRestartData(serverCode);

        return Ok(restartData);
    }

    /// <summary>
    /// Gets the routes with valid lines (more than 20 points).
    /// </summary>
    /// <returns>An array of route identifiers</returns>
    [HttpGet("route-lines")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<string[]>> GetRouteLines() =>
        Ok(await routePointAnalyzerService.GetRoutesWithValidLines());

    /// <summary>
    /// Gets the list of known stations.
    /// </summary>
    /// <returns>An array of known stations</returns>
    [HttpGet("known-stations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<Station[]> GetKnownStations() =>
        Ok(stationAnalyzerService.GetStations());

    /// <summary>
    /// Sets the known stations.
    /// </summary>
    [HttpPost("known-stations")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(NotFoundError))]
    public ActionResult<Station[]> PostKnownStations(
        [FromHeader] string password,
        Station[]? stations)
    {
        if (!ValidatePassword(password))
            return Unauthorized(new NotFoundError("Invalid password", "invalid_password"));

        if (stations == null || stations.Length == 0)
            return BadRequest(new NotFoundError("No stations provided", "no_stations_provided"));

        stationAnalyzerService.SetStations(stations);
        return Ok(stationAnalyzerService.GetStations());
    }
}