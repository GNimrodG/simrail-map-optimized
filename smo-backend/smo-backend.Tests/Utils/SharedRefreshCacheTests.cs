using FluentAssertions;
using SMOBackend.Utils;

namespace SMOBackend.Tests.Utils;

public class SharedRefreshCacheTests
{
    private static readonly TimeSpan MaxAge = TimeSpan.FromHours(6);

    [Fact]
    public async Task CallerGivingUp_DoesNotCancelTheComputation()
    {
        var release = new TaskCompletionSource();
        var computations = 0;
        var cache = new SharedRefreshCache<string>(async () =>
        {
            Interlocked.Increment(ref computations);
            await release.Task;
            return "area";
        }, MaxAge);

        // the first caller (a request whose client leaves) stops waiting
        using var leaving = new CancellationTokenSource();
        var first = cache.GetAsync(leaving.Token);
        await leaving.CancelAsync();
        await FluentActions.Awaiting(() => first).Should().ThrowAsync<OperationCanceledException>();

        // the computation goes on, a second caller gets its result without computing again
        var second = cache.GetAsync();
        release.SetResult();
        (await second).Should().Be("area");
        computations.Should().Be(1);
        cache.Current.Should().Be("area");
    }

    [Fact]
    public async Task ConcurrentCallers_ShareOneComputation()
    {
        var release = new TaskCompletionSource();
        var computations = 0;
        var cache = new SharedRefreshCache<string>(async () =>
        {
            Interlocked.Increment(ref computations);
            await release.Task;
            return "area";
        }, MaxAge);

        var callers = Enumerable.Range(0, 5).Select(_ => cache.GetAsync()).ToArray();
        release.SetResult();

        (await Task.WhenAll(callers)).Should().AllBe("area");
        computations.Should().Be(1);
    }

    [Fact]
    public async Task OldValue_IsReturnedAtOnceWhileTheNewOneIsComputed()
    {
        var time = new ManualTime();
        var release = new TaskCompletionSource();
        var values = new Queue<string>(["old", "new"]);
        var cache = new SharedRefreshCache<string>(async () =>
        {
            var value = values.Dequeue();
            if (value == "new") await release.Task;
            return value;
        }, MaxAge, time);

        (await cache.GetAsync()).Should().Be("old");
        time.Advance(MaxAge + TimeSpan.FromMinutes(1));

        // expired: nobody waits for the slow refresh
        var stale = cache.GetAsync();
        stale.IsCompleted.Should().BeTrue();
        (await stale).Should().Be("old");

        release.SetResult();
        (await cache.StartRefresh()).Should().Be("new");
        (await cache.GetAsync()).Should().Be("new");
    }

    [Fact]
    public async Task NoValue_KeepsThePreviousOneAndTriesAgain()
    {
        var time = new ManualTime();
        var values = new Queue<string?>([null, "area", null]);
        var cache = new SharedRefreshCache<string>(() => Task.FromResult(values.Dequeue()), MaxAge, time);

        (await cache.GetAsync()).Should().BeNull();
        (await cache.GetAsync()).Should().Be("area"); // nothing was cached, so it's computed again

        time.Advance(MaxAge + TimeSpan.FromMinutes(1));
        (await cache.StartRefresh()).Should().Be("area");
        cache.Current.Should().Be("area");
    }

    [Fact]
    public async Task FreshValue_IsNotComputedAgain()
    {
        var computations = 0;
        var cache = new SharedRefreshCache<string>(() =>
        {
            Interlocked.Increment(ref computations);
            return Task.FromResult<string?>("area");
        }, MaxAge);

        await cache.StartRefresh(); // e.g. at startup
        (await cache.GetAsync()).Should().Be("area");
        (await cache.GetAsync()).Should().Be("area");

        computations.Should().Be(1);
    }

    private sealed class ManualTime : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 11, 13, 12, 0, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }
}
