using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using SMOBackend.Models.OSM;

namespace SMOBackend.Services;

/// <summary>
/// Client for interacting with the OpenStreetMap Overpass API with request batching and caching
/// </summary>
public class OsmApiClient : IDisposable
{
    private const string BaseUrl = "https://overpass-api.de/api/interpreter";
    private readonly Timer _batchTimer;
    private readonly HttpClient _httpClient = new();
    private readonly ILogger<OsmApiClient> _logger;

    // Cache for pending requests
    private readonly ConcurrentDictionary<string, TaskCompletionSource<OSMWay?>> _pendingRequests = new();
    private readonly Lock _timerLock = new();
    private volatile bool _timerScheduled;

    /// <summary>
    /// Initializes a new instance of the OsmApiClient
    /// </summary>
    public OsmApiClient(ILogger<OsmApiClient> logger)
    {
        _logger = logger;
        _batchTimer = new(ProcessBatchedRequests, null, Timeout.Infinite, Timeout.Infinite);
    }

    /// <summary>
    ///     Disposes the OSM API client and releases all resources
    /// </summary>
    public void Dispose()
    {
        _batchTimer.Dispose();
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Gets a signal box by name, with automatic request batching and caching
    /// </summary>
    /// <param name="name">The name of the signal box to search for</param>
    /// <returns>The OSM way representing the signal box, or null if not found</returns>
    public async Task<OSMWay?> GetSignalBoxByNameAsync(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return null;

        // Check if request is already pending
        var tcs = _pendingRequests.GetOrAdd(name, _ => new());

        // Schedule batch processing if not already scheduled
        lock (_timerLock)
        {
            // ReSharper disable once InvertIf
            if (!_timerScheduled)
            {
                _batchTimer.Change(1000, Timeout.Infinite); // Process in 1 second
                _timerScheduled = true;
            }
        }

        return await tcs.Task;
    }

    private async void ProcessBatchedRequests(object? state)
    {
        lock (_timerLock)
        {
            _timerScheduled = false;
        }

        if (_pendingRequests.IsEmpty)
            return;

        // Get all pending requests
        var requestsToProcess = new Dictionary<string, TaskCompletionSource<OSMWay?>>();
        while (!_pendingRequests.IsEmpty)
        {
            foreach (var kvp in _pendingRequests)
            {
                if (_pendingRequests.TryRemove(kvp.Key, out var tcs))
                {
                    requestsToProcess[kvp.Key] = tcs;
                }
            }
        }

        if (requestsToProcess.Count == 0)
            return;

        var stopwatch = Stopwatch.StartNew();
        try
        {
            _logger.LogInformation("Processing {Count} batched requests for signal boxes", requestsToProcess.Count);
            _logger.LogTrace("Requests: {Requests}", string.Join(", ", requestsToProcess.Keys));


            // Build union query for all requested signal boxes using contains filter
            var queryBuilder = new StringBuilder();
            queryBuilder.Append("[out:json];(");

            foreach (var name in requestsToProcess.Keys)
            {
                // Escape quotes in name for Overpass query
                var escapedName = name.Replace("\"", "\\\"");
                queryBuilder.Append($"way[\"name\"~\"{escapedName}\"][\"railway\"=\"signal_box\"];");
            }

            queryBuilder.Append(");out center;");
            var query = queryBuilder.ToString();

            // Send POST request with the batched query
            var content = new StringContent(query, Encoding.UTF8, "application/x-www-form-urlencoded");

            using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(5));
            var response = await _httpClient.PostAsync(BaseUrl, content, cts.Token);

            if (response.IsSuccessStatusCode)
            {
                var osmResponse = await response.Content.ReadFromJsonAsync<OSMResponse>();
                var elements = osmResponse?.Elements ?? [];

                // Match results back to requests
                foreach (var (name, tcs) in requestsToProcess)
                {
                    // Find all matching elements that contain the search term
                    var matchingElements = elements.Where(e =>
                        e.Tags.TryGetValue("name", out var elementName) &&
                        elementName.Contains(name, StringComparison.OrdinalIgnoreCase)).ToList();

                    OSMWay? bestMatch = null;
                    if (matchingElements.Count > 0)
                    {
                        // If multiple matches, pick the closest one (shortest name or exact match)
                        bestMatch = matchingElements
                            .OrderBy(e =>
                                e.Tags["name"].Equals(name, StringComparison.OrdinalIgnoreCase)
                                    ? 0
                                    : 1) // Exact matches first
                            .ThenBy(e => e.Tags["name"].Length) // Then shortest names
                            .ThenBy(e =>
                                LevenshteinDistance(name.ToLowerInvariant(),
                                    e.Tags["name"].ToLowerInvariant())) // Then by edit distance
                            .First();
                    }

                    tcs.SetResult(bestMatch);
                }
            }
            else
            {
                // Set all requests to null on failure
                foreach (var tcs in requestsToProcess.Values)
                {
                    tcs.SetResult(null);
                }
            }
        }
        catch (Exception ex)
        {
            // Set all requests to null on exception
            foreach (var tcs in requestsToProcess.Values)
            {
                tcs.SetException(ex);
            }
        }
        finally
        {
            stopwatch.Stop();
            _logger.LogInformation("Processed {Count} batched requests in {ElapsedMilliseconds} ms",
                requestsToProcess.Count, stopwatch.ElapsedMilliseconds);
        }
    }

    /// <summary>
    /// Calculates the Levenshtein distance between two strings
    /// </summary>
    /// <param name="source">First string</param>
    /// <param name="target">Second string</param>
    /// <returns>The edit distance between the strings</returns>
    private static int LevenshteinDistance(string source, string target)
    {
        if (string.IsNullOrEmpty(source))
            return string.IsNullOrEmpty(target) ? 0 : target.Length;

        if (string.IsNullOrEmpty(target))
            return source.Length;

        var distance = new int[source.Length + 1, target.Length + 1];

        for (var i = 0; i <= source.Length; i++)
            distance[i, 0] = i;

        for (var j = 0; j <= target.Length; j++)
            distance[0, j] = j;

        for (var i = 1; i <= source.Length; i++)
        {
            for (var j = 1; j <= target.Length; j++)
            {
                var cost = target[j - 1] == source[i - 1] ? 0 : 1;
                distance[i, j] = Math.Min(
                    Math.Min(distance[i - 1, j] + 1, distance[i, j - 1] + 1),
                    distance[i - 1, j - 1] + cost);
            }
        }

        return distance[source.Length, target.Length];
    }
}