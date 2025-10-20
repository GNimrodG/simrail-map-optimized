using System.Collections.Concurrent;
using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models.Entity;

namespace SMOBackend.Utils;

/// <summary>
/// Buffers stat samples and flushes them to the database in batches to reduce write amplification.
/// </summary>
internal static class StatsBuffer
{
    private readonly record struct StatSample(string ServiceId, int Duration);

    private static readonly ConcurrentQueue<StatSample> Queue = new();
    private static readonly SemaphoreSlim FlushLock = new(1, 1);

    private static readonly int BatchSize = StdUtils.GetEnvVar("STATS_FLUSH_BATCH_SIZE", 100);
    private static readonly TimeSpan FlushInterval =
        TimeSpan.FromSeconds(Math.Max(1, StdUtils.GetEnvVar("STATS_FLUSH_INTERVAL_SECONDS", 30)));

    private static readonly Lock TimerLock = new();
    private static readonly Gauge QueueGauge = Metrics.CreateGauge(
        "smo_stats_buffer_queue",
        "Number of stat samples waiting to be flushed to the database");
    private static Timer? _flushTimer;
    private static volatile bool _flushPending;
    private static int _pendingSamples;

    internal static void Enqueue(IServiceScopeFactory scopeFactory, string serviceId, int duration,
        CancellationToken? stoppingToken)
    {
        Queue.Enqueue(new(serviceId, duration));
        var pending = Interlocked.Increment(ref _pendingSamples);
        QueueGauge.Set(pending);

        EnsureTimerInitialized(scopeFactory);

        if (Volatile.Read(ref _pendingSamples) >= BatchSize)
        {
            ScheduleFlush(scopeFactory, stoppingToken);
        }
    }

    private static void EnsureTimerInitialized(IServiceScopeFactory scopeFactory)
    {
        if (_flushTimer != null) return;

        lock (TimerLock)
        {
            if (_flushTimer != null) return;

            _flushTimer = new(_ => ScheduleFlush(scopeFactory, null), null, FlushInterval, FlushInterval);
        }
    }

    private static void ScheduleFlush(IServiceScopeFactory scopeFactory, CancellationToken? stoppingToken)
    {
        if (_flushPending) return;

        _flushPending = true;
        _ = Task.Run(async () =>
        {
            try
            {
                await FlushAsync(scopeFactory, stoppingToken).NoContext();
            }
            finally
            {
                _flushPending = false;

                // If new items arrived while we were flushing, schedule another run immediately
                if (!Queue.IsEmpty)
                {
                    ScheduleFlush(scopeFactory, stoppingToken);
                }
            }
        });
    }

    private static async Task FlushAsync(IServiceScopeFactory scopeFactory, CancellationToken? stoppingToken)
    {
        if (Queue.IsEmpty) return;

        await FlushLock.WaitAsync().NoContext();
        try
        {
            if (Queue.IsEmpty) return;

            using var scope = scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

            var batch = new List<StatSample>(BatchSize);

            while (batch.Count < BatchSize && Queue.TryDequeue(out var sample))
            {
                batch.Add(sample);
            }

            if (batch.Count == 0)
            {
                QueueGauge.Set(Math.Max(Volatile.Read(ref _pendingSamples), 0));
                return;
            }

            var remaining = Interlocked.Add(ref _pendingSamples, -batch.Count);
            QueueGauge.Set(Math.Max(remaining, 0));

            await context.Stats.AddRangeAsync(batch.Select(static sample => new Stat(sample.ServiceId, sample.Duration)));

            if (stoppingToken.HasValue)
            {
                await context.SaveChangesAsync(stoppingToken.Value).NoContext();
            }
            else
            {
                await context.SaveChangesAsync().NoContext();
            }
        }
        finally
        {
            FlushLock.Release();
        }
    }
}
