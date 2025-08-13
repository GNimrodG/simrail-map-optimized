using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
// added for UTF8 byte count

// added for JsonNumberHandling

namespace SMOBackend.Services;

/// <summary>
///     Multi-level caching service that combines in-memory and distributed caching
///     to reduce database load for frequently accessed data.
/// </summary>
public class CachingService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals,
        PropertyNameCaseInsensitive = true
    };

    private readonly IDistributedCache _distributedCache;
    private readonly ILogger<CachingService> _logger;
    private readonly IMemoryCache _memoryCache;

    public CachingService(
        IMemoryCache memoryCache,
        IDistributedCache distributedCache,
        ILogger<CachingService> logger)
    {
        _memoryCache = memoryCache;
        _distributedCache = distributedCache;
        _logger = logger;
    }

    /// <summary>
    ///     Gets a value from cache with multi-level fallback (memory -> distributed -> source)
    /// </summary>
    public async Task<T?> GetOrSetAsync<T>(
        string key,
        Func<Task<T>> factory,
        TimeSpan? memoryExpiry = null,
        TimeSpan? distributedExpiry = null)
    {
        // Try memory cache first
        if (_memoryCache.TryGetValue(key, out T? cachedValue)) return cachedValue;

        // Try distributed cache
        try
        {
            var distributedValue = await _distributedCache.GetStringAsync(key);
            if (!string.IsNullOrEmpty(distributedValue))
            {
                var deserializedValue = JsonSerializer.Deserialize<T>(distributedValue, JsonOptions);
                if (deserializedValue != null)
                {
                    // Store back in memory cache for faster access with size
                    var sizeFromSerialized = GetSerializedSize(distributedValue);
                    _memoryCache.Set(
                        key,
                        deserializedValue,
                        new MemoryCacheEntryOptions
                        {
                            AbsoluteExpirationRelativeToNow = memoryExpiry ?? TimeSpan.FromMinutes(5),
                            Size = sizeFromSerialized
                        }
                    );
                    return deserializedValue;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to retrieve from distributed cache for key: {Key}", key);
        }

        // Fallback to source
        var value = await factory();
        if (value == null) return value;

        // Serialize once for both caches and sizing
        string? serializedValueForSize = null;
        long estimatedSize;
        try
        {
            serializedValueForSize = JsonSerializer.Serialize(value, JsonOptions);
            estimatedSize = GetSerializedSize(serializedValueForSize);
        }
        catch
        {
            // If serialization fails for sizing, fall back to a minimal size of 1
            estimatedSize = 1;
        }

        // Store in memory cache with size
        _memoryCache.Set(
            key,
            value,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = memoryExpiry ?? TimeSpan.FromMinutes(5),
                Size = estimatedSize
            }
        );

        // Store in distributed cache (use serialized string if available)
        try
        {
            var serializedValue = serializedValueForSize ?? JsonSerializer.Serialize(value, JsonOptions);
            await _distributedCache.SetStringAsync(
                key,
                serializedValue,
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = distributedExpiry ?? TimeSpan.FromMinutes(15)
                });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to store in distributed cache for key: {Key}", key);
        }

        return value;
    }

    /// <summary>
    ///     Invalidates a cache entry from both memory and distributed cache
    /// </summary>
    public async Task InvalidateAsync(string key)
    {
        _memoryCache.Remove(key);
        try
        {
            await _distributedCache.RemoveAsync(key);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to remove from distributed cache for key: {Key}", key);
        }
    }

    private static long GetSerializedSize(string serialized)
    {
        try
        {
            // Number of bytes in UTF8 representation as a proxy for memory size
            return Encoding.UTF8.GetByteCount(serialized);
        }
        catch
        {
            return 1;
        }
    }
}