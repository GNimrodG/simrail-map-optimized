namespace SMOBackend.Services;

public interface IDataService
{
    /// <summary>
    /// Retrieves the fetch interval from the environment variable or uses the default value.
    /// </summary>
    /// <returns>The fetch interval.</returns>
    TimeSpan GetFetchInterval();

    /// <summary>
    /// The ID of the service.
    /// </summary>
    string ServiceId { get; }

    /// <summary>
    /// The last time the data was fetched.
    /// </summary>
    DateTime LastFetch { get; }
}