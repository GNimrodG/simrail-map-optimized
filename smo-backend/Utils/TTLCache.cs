using System.Diagnostics.CodeAnalysis;
using MessagePack;
using MessagePack.Resolvers;
using Microsoft.Extensions.Caching.Memory;
using Prometheus;
using Timer = System.Timers.Timer;

namespace SMOBackend.Utils;

/// <summary>
/// A simple in-memory cache with a time-to-live (TTL) for each entry.
/// </summary>
public class TtlCache<TKey, TValue> : IDisposable
    where TKey : notnull
{
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());
    private readonly Timer? _gaugeUpdateTimer;

    private readonly string _instanceName;
    private readonly TimeSpan? _ttl;
    private bool _disposed;

    /// <summary>
    ///     A simple in-memory cache with a time-to-live (TTL) for each entry.
    /// </summary>
    public TtlCache(TimeSpan? ttl, string? name = null)
    {
        _ttl = ttl;
        _instanceName = name ?? $"{typeof(TKey).Name}_{typeof(TValue).Name}";
        
        if (_ttl == null) return;
        
        _gaugeUpdateTimer = new(_ttl.Value.TotalMilliseconds);
        _gaugeUpdateTimer.Elapsed += (_, _) => CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);
        _gaugeUpdateTimer.AutoReset = true;
        _gaugeUpdateTimer.Start();
    }

    /// <inheritdoc cref="Dictionary{TKey,TValue}.Keys"/>
    public IEnumerable<TKey> Keys => _cache.Keys as IEnumerable<TKey> ?? [];

    /// <inheritdoc cref="Dictionary{TKey,TValue}.Count" />
    public int Count => _cache.Count;

    // ReSharper disable once StaticMemberInGenericType
    private static Gauge CacheSizeGauge { get; } = Metrics.CreateGauge(
        "smo_cache_size",
        "Size of the keys in the TTL cache",
        new GaugeConfiguration
        {
            LabelNames = ["cache_name"]
        });

    /// <summary>
    ///     Gets or sets the value associated with the specified key.
    /// </summary>
    /// <param name="key">The key of the value to get or set.</param>
    /// <returns>The value associated with the specified key.</returns>
    /// <exception cref="KeyNotFoundException">Thrown when getting a value and the key is not found in the cache.</exception>
    public TValue this[TKey key]
    {
        get
        {
            if (TryGetValue(key, out var value))
                return value;

            throw new KeyNotFoundException($"The key '{key}' was not found in the cache.");
        }
        set => Set(key, value);
    }

    /// <inheritdoc cref="IDisposable.Dispose" />
    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _gaugeUpdateTimer?.Stop();
        _gaugeUpdateTimer?.Dispose();
        _cache.Dispose();
        KeyAdded = null;
        CacheSizeGauge.RemoveLabelled(_instanceName);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    ///     Event that is triggered when a new key is added to the cache.
    /// </summary>
    public event EventHandler<TKey>? KeyAdded;

    private void _add(TKey key, TValue value)
    {
        _cache.Set(key, value, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = _ttl
        });
    }

    /// <inheritdoc cref="Dictionary{TKey,TValue}.Add"/>
    public void Add(TKey key, TValue value)
    {
        _add(key, value);
        CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);
        KeyAdded?.Invoke(this, key);
    }

    /// <inheritdoc cref="Dictionary{TKey,TValue}.TryGetValue"/>
    public bool TryGetValue(TKey key, [MaybeNullWhen(false)] out TValue value)
    {
        CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);

        if (_cache.TryGetValue(key, out var cachedValue) && cachedValue is TValue)
        {
            // Check if the cached value is of the expected type
            if (cachedValue is not TValue result)
            {
                value = default!;
                return false;
            }

            // Cast the cached value to the expected type
            value = result;
            return true;
        }

        value = default!;
        return false;
    }

    /// <inheritdoc cref="Dictionary{TKey,TValue}.ContainsKey"/>
    public bool ContainsKey(TKey key) => _cache.TryGetValue(key, out _);

    /// <inheritdoc cref="Dictionary{TKey,TValue}.Clear"/>
    public void Clear()
    {
        foreach (var key in _cache.Keys)
        {
            _cache.Remove(key);
        }

        CacheSizeGauge.WithLabels(_instanceName).Set(0);
    }

    /// <summary>
    /// Gets the value for the specified key, or adds it if it doesn't exist.
    /// </summary>
    public TValue GetOrAdd(TKey key, Func<TValue> valueFactory)
    {
        CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);

        if (TryGetValue(key, out var value) && value != null)
            return value;

        value = valueFactory();
        Add(key, value);
        CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);
        KeyAdded?.Invoke(this, key);
        return value;
    }

    /// <summary>
    /// Sets the value for the specified key, adding it if it doesn't exist.
    /// </summary>
    public void Set(TKey key, TValue value)
    {
        _add(key, value);
        CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);
        KeyAdded?.Invoke(this, key);
    }

    /// <summary>
    /// Removes the specified key from the cache.
    /// </summary>
    /// <param name="key">The key to remove.</param>
    /// <returns>True if the key was found and removed; otherwise, false.</returns>
    public bool Remove(TKey key)
    {
        if (!_cache.TryGetValue(key, out _)) return false;

        _cache.Remove(key);
        CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);
        return true;
    }

    /// <summary>
    /// Saves the cache to a file using MessagePack serialization.
    /// </summary>
    /// <param name="filePath">Path to the file to save to.</param>
    public async Task SaveToFileAsync(string filePath)
    {
        var tempFilePath = filePath + ".tmp";

        await using var stream = new FileStream(
            tempFilePath,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 4096,
            useAsync: true);

        var value = _cache.Keys.Where(key => _cache.Get(key) is TValue)
            .ToDictionary(key => (TKey)key, key => _cache.Get(key));

        await MessagePackSerializer.SerializeAsync(stream, value,
            ContractlessStandardResolver.Options);

        await stream.FlushAsync();

        stream.Close();

        // Rename the file to remove the .tmp extension
        if (File.Exists(filePath)) File.Delete(filePath);
        File.Move(tempFilePath, filePath);
    }

    /// <summary>
    /// Loads the cache from a file using MessagePack serialization.
    /// </summary>
    /// <param name="filePath">Path to the file to load from.</param>
    public void LoadFromFile(string filePath)
    {
        var tempFilePath = filePath + ".tmp";

        // Delete leftover temp file if it exists
        if (File.Exists(tempFilePath))
            File.Delete(tempFilePath);

        using var stream = new FileStream(
            filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            bufferSize: 4096,
            useAsync: false);

        var value = MessagePackSerializer.Deserialize<Dictionary<TKey, TValue>>(
            stream,
            ContractlessStandardResolver.Options);

        Clear();

        foreach (var kvp in value) _add(kvp.Key, kvp.Value);

        CacheSizeGauge.WithLabels(_instanceName).Set(_cache.Count);
    }

    ~TtlCache() => Dispose();
}