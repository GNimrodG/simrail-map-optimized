namespace SMOBackend.Utils;

/// <summary>
///     A value that is slow to compute, shared by all callers and refreshed when it gets old.
///     <list type="bullet">
///         <item>One computation at a time: callers arriving while it runs wait for the same one.</item>
///         <item>
///             The computation doesn't belong to any caller: a caller that gives up (e.g. an HTTP request whose client
///             left) only stops waiting, the computation finishes and its value is kept for the next callers.
///         </item>
///         <item>
///             Stale-while-revalidate: once there is a value, nobody waits anymore; an old value is returned at once
///             while the new one is computed in the background.
///         </item>
///     </list>
/// </summary>
/// <param name="compute">
///     Computes the value, or returns null when there is none (yet), which keeps the previous value. Must handle its own
///     errors and cancellation (it's not tied to any caller).
/// </param>
/// <param name="maxAge">How long a value is used before it's computed again.</param>
/// <param name="timeProvider">The clock, <see cref="TimeProvider.System" /> by default.</param>
public sealed class SharedRefreshCache<T>(Func<Task<T?>> compute, TimeSpan maxAge, TimeProvider? timeProvider = null)
    where T : class
{
    private readonly Lock _gate = new();
    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;

    // a reference, so a reader never sees half of an update
    private volatile Entry? _entry;
    private Task<T?>? _refresh;

    /// <summary>
    ///     The current value, however old, or null when it was never computed.
    /// </summary>
    public T? Current => _entry?.Value;

    /// <summary>
    ///     Gets the value: the current one when it's fresh, the old one while a new one is computed, and only waits when
    ///     there's no value at all yet.
    /// </summary>
    /// <param name="cancellationToken">Stops waiting for the first computation (the computation itself goes on).</param>
    public Task<T?> GetAsync(CancellationToken cancellationToken = default)
    {
        var entry = _entry;
        if (entry != null && _time.GetUtcNow() - entry.ComputedAt < maxAge) return Task.FromResult<T?>(entry.Value);

        var refresh = StartRefresh();
        return entry != null ? Task.FromResult<T?>(entry.Value) : refresh.WaitAsync(cancellationToken);
    }

    /// <summary>
    ///     Starts computing the value unless a computation is already running (e.g. to have it ready at startup).
    /// </summary>
    /// <returns>The running computation, with the new value (or the previous one if there's no new value).</returns>
    public Task<T?> StartRefresh()
    {
        lock (_gate) return _refresh ??= RefreshAsync();
    }

    private async Task<T?> RefreshAsync()
    {
        try
        {
            // off the caller's thread, and out of the lock that stores this task
            await Task.Yield();

            var value = await compute();
            if (value == null) return _entry?.Value;

            _entry = new(value, _time.GetUtcNow());
            return value;
        }
        finally
        {
            lock (_gate) _refresh = null;
        }
    }

    private sealed record Entry(T Value, DateTimeOffset ComputedAt);
}
