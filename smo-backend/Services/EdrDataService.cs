using SMOBackend.Models;
using SMOBackend.Services.ApiClients;

namespace SMOBackend.Services;

/// <summary>
/// Service for fetching the unusual cargo flags of the trains from the EDR timetables.
/// Only trains with at least one flag are stored.
/// </summary>
public class EdrDataService(
    ILogger<EdrDataService> logger,
    IServiceScopeFactory scopeFactory,
    ServerDataService serverDataService,
    SimrailApiClient apiClient)
    : BaseServerDataService<Dictionary<string, UnusualCargo>>("EDR", logger, scopeFactory, serverDataService)
{
    /// <inheritdoc />
    protected override TimeSpan FetchInterval => TimeSpan.FromHours(1);

    // The responses are large and share the API quota with the other services
    private protected override TimeSpan DelayBetweenServers => TimeSpan.FromSeconds(1);

    /// <inheritdoc />
    protected override async Task<Dictionary<string, UnusualCargo>> FetchServerData(string serverCode,
        CancellationToken stoppingToken)
    {
        var trains = await apiClient.GetEdrTimetablesAsync<EdrTrainUnusualCargo>(serverCode, stoppingToken);

        var result = new Dictionary<string, UnusualCargo>(StringComparer.Ordinal);
        foreach (var train in trains)
        {
            var cargo = train.ToUnusualCargo();
            if (cargo != UnusualCargo.None) result[string.Intern(train.TrainNoLocal)] = cargo;
        }

        return result;
    }

    /// <summary>
    /// Gets the unusual cargo flags of a train, or <see cref="UnusualCargo.None"/> if it has none
    /// or the EDR timetable of the server is not loaded yet.
    /// </summary>
    public UnusualCargo GetUnusualCargo(string serverCode, string trainNoLocal) =>
        this[serverCode]?.GetValueOrDefault(trainNoLocal) ?? UnusualCargo.None;
}
