using FluentAssertions;
using SMOBackend.Utils;

namespace SMOBackend.Tests.Utils;

/// <summary>
///     Unit tests for <see cref="TtlCache{TKey,TValue}" />.
/// </summary>
public class TtlCacheTests
{
    // ──────────────────────────────────────────────
    //  Basic Operations
    // ──────────────────────────────────────────────

    [Fact]
    public void Add_StoresValue_AndAllowsRetrieval()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        cache.Add("key1", 42);

        cache.TryGetValue("key1", out var value).Should().BeTrue();
        value.Should().Be(42);
    }

    [Fact]
    public void Set_StoresValue_AndAllowsRetrieval()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        cache.Set("key1", 42);

        cache.TryGetValue("key1", out var value).Should().BeTrue();
        value.Should().Be(42);
    }

    [Fact]
    public void Set_OverwritesExistingValue()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        cache.Set("key1", 42);
        cache.Set("key1", 100);

        cache.TryGetValue("key1", out var value).Should().BeTrue();
        value.Should().Be(100);
    }

    [Fact]
    public void Indexer_Get_ReturnsValue_WhenKeyExists()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);

        var value = cache["key1"];

        value.Should().Be(42);
    }

    [Fact]
    public void Indexer_Get_ThrowsKeyNotFoundException_WhenKeyDoesNotExist()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        var act = () => cache["nonexistent"];

        act.Should().Throw<KeyNotFoundException>()
            .WithMessage("*key*not found*");
    }

    [Fact]
    public void Indexer_Set_StoresValue()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        cache["key1"] = 42;

        cache["key1"].Should().Be(42);
    }

    [Fact]
    public void TryGetValue_ReturnsFalse_WhenKeyDoesNotExist()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        var result = cache.TryGetValue("nonexistent", out var value);

        result.Should().BeFalse();
        value.Should().Be(0); // Default for int
    }

    [Fact]
    public void ContainsKey_ReturnsTrue_WhenKeyExists()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);

        var exists = cache.ContainsKey("key1");

        exists.Should().BeTrue();
    }

    [Fact]
    public void ContainsKey_ReturnsFalse_WhenKeyDoesNotExist()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        var exists = cache.ContainsKey("nonexistent");

        exists.Should().BeFalse();
    }

    [Fact]
    public void Remove_RemovesKey_ReturnsTrue()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);

        var removed = cache.Remove("key1");

        removed.Should().BeTrue();
        cache.ContainsKey("key1").Should().BeFalse();
    }

    [Fact]
    public void Remove_ReturnsFalse_WhenKeyDoesNotExist()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        var removed = cache.Remove("nonexistent");

        removed.Should().BeFalse();
    }

    [Fact]
    public void Clear_RemovesAllEntries()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);
        cache.Add("key2", 100);
        cache.Add("key3", 200);

        cache.Clear();

        cache.Count.Should().Be(0);
        cache.ContainsKey("key1").Should().BeFalse();
        cache.ContainsKey("key2").Should().BeFalse();
        cache.ContainsKey("key3").Should().BeFalse();
    }

    [Fact]
    public void Count_ReturnsCorrectNumberOfEntries()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        cache.Count.Should().Be(0);

        cache.Add("key1", 1);
        cache.Count.Should().Be(1);

        cache.Add("key2", 2);
        cache.Count.Should().Be(2);

        cache.Remove("key1");
        cache.Count.Should().Be(1);
    }

    [Fact]
    public void Keys_ReturnsAllKeys()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 1);
        cache.Add("key2", 2);
        cache.Add("key3", 3);

        var keys = cache.Keys.ToArray();

        keys.Should().BeEquivalentTo("key1", "key2", "key3");
    }

    // ──────────────────────────────────────────────
    //  GetOrAdd Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void GetOrAdd_ReturnsExistingValue_WhenKeyExists()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);

        var value = cache.GetOrAdd("key1", () => 100);

        value.Should().Be(42);
    }

    [Fact]
    public void GetOrAdd_AddsAndReturnsNewValue_WhenKeyDoesNotExist()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        var value = cache.GetOrAdd("key1", () => 100);

        value.Should().Be(100);
        cache["key1"].Should().Be(100);
    }

    [Fact]
    public void GetOrAdd_CallsFactoryOnlyOnce_WhenKeyDoesNotExist()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        var callCount = 0;

        cache.GetOrAdd("key1", () =>
        {
            callCount++;
            return 42;
        });

        callCount.Should().Be(1);
    }

    [Fact]
    public void GetOrAdd_DoesNotCallFactory_WhenKeyExists()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);
        var callCount = 0;

        cache.GetOrAdd("key1", () =>
        {
            callCount++;
            return 100;
        });

        callCount.Should().Be(0);
    }

    // ──────────────────────────────────────────────
    //  Max Entries Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void MaxEntries_EnforcesLimit_RemovesOldestEntry()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1), maxEntries: 3);

        cache.Add("key1", 1);
        cache.Add("key2", 2);
        cache.Add("key3", 3);
        cache.Add("key4", 4); // Should evict key1

        cache.Count.Should().Be(3);
        cache.ContainsKey("key1").Should().BeFalse();
        cache.ContainsKey("key2").Should().BeTrue();
        cache.ContainsKey("key3").Should().BeTrue();
        cache.ContainsKey("key4").Should().BeTrue();
    }

    [Fact]
    public void MaxEntries_AllowsUnlimitedEntries_WhenSetToNegativeOne()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1), maxEntries: -1);

        for (var i = 0; i < 1000; i++) cache.Add($"key{i}", i);

        cache.Count.Should().Be(1000);
    }

    [Fact]
    public void MaxEntries_AllowsUnlimitedEntries_WhenSetToZero()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1), maxEntries: 0);

        for (var i = 0; i < 100; i++) cache.Add($"key{i}", i);

        cache.Count.Should().Be(100);
    }

    [Fact]
    public void MaxEntries_UpdateExistingKey_DoesNotEvictOtherKeys()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1), maxEntries: 2);

        cache.Add("key1", 1);
        cache.Add("key2", 2);
        cache.Set("key1", 100); // Update existing

        cache.Count.Should().Be(2);
        cache.ContainsKey("key1").Should().BeTrue();
        cache.ContainsKey("key2").Should().BeTrue();
        cache["key1"].Should().Be(100);
    }

    // ──────────────────────────────────────────────
    //  TTL Expiration Tests
    // ──────────────────────────────────────────────

    [Fact]
    public async Task TtlExpiration_RemovesExpiredEntries()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMilliseconds(100));
        cache.Add("key1", 42);

        // Wait for TTL to expire
        await Task.Delay(150);

        cache.ContainsKey("key1").Should().BeFalse();
        cache.TryGetValue("key1", out _).Should().BeFalse();
    }

    [Fact]
    public async Task TtlExpiration_OnlyRemovesExpiredEntries_KeepsValid()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMilliseconds(200));
        cache.Add("key1", 1);

        await Task.Delay(100);
        cache.Add("key2", 2);

        await Task.Delay(120); // key1 should be expired, key2 should still be valid

        cache.ContainsKey("key1").Should().BeFalse();
        cache.ContainsKey("key2").Should().BeTrue();
    }

    [Fact]
    public void TtlExpiration_NullTtl_KeepsEntriesIndefinitely()
    {
        using var cache = new TtlCache<string, int>(null);
        cache.Add("key1", 42);

        // No expiration should happen
        cache.ContainsKey("key1").Should().BeTrue();
    }

    // ──────────────────────────────────────────────
    //  KeyAdded Event Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void KeyAdded_Event_TriggersOnAdd()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        var eventTriggered = false;
        string? capturedKey = null;

        cache.KeyAdded += (_, key) =>
        {
            eventTriggered = true;
            capturedKey = key;
        };

        cache.Add("key1", 42);

        eventTriggered.Should().BeTrue();
        capturedKey.Should().Be("key1");
    }

    [Fact]
    public void KeyAdded_Event_TriggersOnSet()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        var eventTriggered = false;

        cache.KeyAdded += (_, _) => { eventTriggered = true; };

        cache.Set("key1", 42);

        eventTriggered.Should().BeTrue();
    }

    [Fact]
    public void KeyAdded_Event_TriggersOnGetOrAdd_WhenKeyDoesNotExist()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        var eventTriggered = false;

        cache.KeyAdded += (_, _) => { eventTriggered = true; };

        cache.GetOrAdd("key1", () => 42);

        eventTriggered.Should().BeTrue();
    }

    [Fact]
    public void KeyAdded_Event_DoesNotTrigger_OnGetOrAdd_WhenKeyExists()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);

        var eventTriggered = false;
        cache.KeyAdded += (_, _) => { eventTriggered = true; };

        cache.GetOrAdd("key1", () => 100);

        eventTriggered.Should().BeFalse();
    }

    // ──────────────────────────────────────────────
    //  Complex Scenarios
    // ──────────────────────────────────────────────

    [Fact]
    public void Cache_HandlesMultipleEntries()
    {
        using var cache = new TtlCache<string, string>(TimeSpan.FromMinutes(1));

        for (var i = 0; i < 100; i++) cache.Add($"key{i}", $"value{i}");

        cache.Count.Should().Be(100);

        for (var i = 0; i < 100; i++) cache[$"key{i}"].Should().Be($"value{i}");
    }

    [Fact]
    public void Cache_WithComplexValueType_StoresAndRetrievesCorrectly()
    {
        using var cache = new TtlCache<string, (int id, string name)>(TimeSpan.FromMinutes(1));

        cache.Add("key1", (42, "test"));

        cache.TryGetValue("key1", out var value).Should().BeTrue();
        value.id.Should().Be(42);
        value.name.Should().Be("test");
    }

    [Fact]
    public void Cache_ThreadSafety_MultipleAddsDoNotCauseErrors()
    {
        using var cache = new TtlCache<int, int>(TimeSpan.FromMinutes(1));
        var tasks = new Task[10];

        for (var i = 0; i < 10; i++)
        {
            var localI = i;
            tasks[i] = Task.Run(() =>
            {
                for (var j = 0; j < 100; j++) cache.Set(localI * 100 + j, j);
            });
        }

        var act = async () => await Task.WhenAll(tasks);

        act.Should().NotThrowAsync();
    }

    [Fact]
    public void Cache_WithMaxEntries_MaintainsInsertionOrder()
    {
        using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1), maxEntries: 3);

        cache.Add("key1", 1);
        cache.Add("key2", 2);
        cache.Add("key3", 3);
        cache.Add("key4", 4); // Should evict key1
        cache.Add("key5", 5); // Should evict key2

        cache.ContainsKey("key1").Should().BeFalse();
        cache.ContainsKey("key2").Should().BeFalse();
        cache.ContainsKey("key3").Should().BeTrue();
        cache.ContainsKey("key4").Should().BeTrue();
        cache.ContainsKey("key5").Should().BeTrue();
    }

    [Fact]
    public void Dispose_ClearsCache()
    {
        var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
        cache.Add("key1", 42);

        cache.Dispose();

        cache.Count.Should().Be(0);
    }

    [Fact]
    public void Dispose_CanBeCalledMultipleTimes()
    {
        var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));

        var act = () =>
        {
            cache.Dispose();
            cache.Dispose();
        };

        act.Should().NotThrow();
    }

    // ──────────────────────────────────────────────
    //  File Persistence Tests
    // ──────────────────────────────────────────────

    [Fact]
    public async Task SaveToFileAsync_AndLoadFromFile_PreservesData()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"cache_test_{Guid.NewGuid()}.bin");

        try
        {
            using var cache1 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache1.Add("key1", 42);
            cache1.Add("key2", 100);
            cache1.Add("key3", 200);

            await cache1.SaveToFileAsync(tempFile);

            using var cache2 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache2.LoadFromFile(tempFile);

            cache2.Count.Should().Be(3);
            cache2["key1"].Should().Be(42);
            cache2["key2"].Should().Be(100);
            cache2["key3"].Should().Be(200);
        }
        finally
        {
            if (File.Exists(tempFile))
                File.Delete(tempFile);
            if (File.Exists(tempFile + ".tmp"))
                File.Delete(tempFile + ".tmp");
        }
    }

    [Fact]
    public async Task SaveToFileAsync_OverwritesExistingFile()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"cache_test_{Guid.NewGuid()}.bin");

        try
        {
            using var cache1 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache1.Add("key1", 42);
            await cache1.SaveToFileAsync(tempFile);

            using var cache2 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache2.Add("key2", 100);
            await cache2.SaveToFileAsync(tempFile); // Overwrite

            using var cache3 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache3.LoadFromFile(tempFile);

            cache3.Count.Should().Be(1);
            cache3.ContainsKey("key1").Should().BeFalse();
            cache3["key2"].Should().Be(100);
        }
        finally
        {
            if (File.Exists(tempFile))
                File.Delete(tempFile);
            if (File.Exists(tempFile + ".tmp"))
                File.Delete(tempFile + ".tmp");
        }
    }

    [Fact]
    public async Task LoadFromFile_ClearsPreviousData()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"cache_test_{Guid.NewGuid()}.bin");

        try
        {
            using var cache1 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache1.Add("key1", 42);
            await cache1.SaveToFileAsync(tempFile);

            using var cache2 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache2.Add("key2", 100);
            cache2.Add("key3", 200);

            cache2.LoadFromFile(tempFile);

            cache2.Count.Should().Be(1);
            cache2.ContainsKey("key1").Should().BeTrue();
            cache2.ContainsKey("key2").Should().BeFalse();
            cache2.ContainsKey("key3").Should().BeFalse();
        }
        finally
        {
            if (File.Exists(tempFile))
                File.Delete(tempFile);
            if (File.Exists(tempFile + ".tmp"))
                File.Delete(tempFile + ".tmp");
        }
    }

    [Fact]
    public async Task LoadFromFile_DeletesLeftoverTempFile()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"cache_test_{Guid.NewGuid()}.bin");
        var tempTmpFile = tempFile + ".tmp";

        try
        {
            using var cache1 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache1.Add("key1", 42);
            await cache1.SaveToFileAsync(tempFile);

            // Create a leftover temp file
            File.WriteAllText(tempTmpFile, "leftover");

            using var cache2 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache2.LoadFromFile(tempFile);

            File.Exists(tempTmpFile).Should().BeFalse();
        }
        finally
        {
            if (File.Exists(tempFile))
                File.Delete(tempFile);
            if (File.Exists(tempTmpFile))
                File.Delete(tempTmpFile);
        }
    }

    [Fact]
    public async Task SaveToFileAsync_WithConcurrentCalls_SerializesAccessProperly()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"cache_test_{Guid.NewGuid()}.bin");

        try
        {
            using var cache = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache.Add("key1", 42);
            cache.Add("key2", 100);
            cache.Add("key3", 200);

            // Start multiple concurrent save operations
            var saveTasks = new List<Task>();
            var exceptions = new List<Exception>();

            for (var i = 0; i < 5; i++)
            {
                var task = Task.Run(async () =>
                {
                    try
                    {
                        // ReSharper disable once AccessToDisposedClosure
                        await cache.SaveToFileAsync(tempFile);
                    }
                    catch (Exception ex)
                    {
                        lock (exceptions)
                        {
                            exceptions.Add(ex);
                        }
                    }
                });
                saveTasks.Add(task);
            }

            // Wait for all save operations to complete
            await Task.WhenAll(saveTasks);

            // No exceptions should occur due to concurrent access
            exceptions.Should().BeEmpty("concurrent saves should be properly synchronized");

            // The file should exist and be valid
            File.Exists(tempFile).Should().BeTrue();

            // Verify we can load the saved data
            using var cache2 = new TtlCache<string, int>(TimeSpan.FromMinutes(1));
            cache2.LoadFromFile(tempFile);

            cache2.Count.Should().Be(3);
            cache2["key1"].Should().Be(42);
            cache2["key2"].Should().Be(100);
            cache2["key3"].Should().Be(200);

            // No temp file should be left over
            File.Exists(tempFile + ".tmp").Should().BeFalse();
        }
        finally
        {
            if (File.Exists(tempFile))
                File.Delete(tempFile);
            if (File.Exists(tempFile + ".tmp"))
                File.Delete(tempFile + ".tmp");
        }
    }
}