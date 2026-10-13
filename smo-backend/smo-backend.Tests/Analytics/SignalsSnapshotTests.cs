using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using SMOBackend.Analytics;
using SMOBackend.Models;

namespace SMOBackend.Tests.Analytics;

/// <summary>
///     Tests for the cached signals snapshot of <see cref="SignalAnalyzerService" />
///     (what clients get after an admin edits a signal).
/// </summary>
public class SignalsSnapshotTests
{
    private static SignalStatus Signal(bool nextFinalized) => new()
    {
        Name = "SIG_A",
        Extra = "extra",
        Location = new(19.0, 51.0) { SRID = 4326 },
        Accuracy = 10,
        Type = "main",
        NextFinalized = nextFinalized
    };

    private static FakeLoadService CreateService(Func<Task<SignalStatus[]>> loader) =>
        new(new Mock<ILogger<SignalAnalyzerService>>().Object, new Mock<IServiceScopeFactory>().Object, loader);

    [Fact]
    public async Task Snapshot_IsReused_WithinCacheDuration()
    {
        var sut = CreateService(() => Task.FromResult(new[] { Signal(false) }));

        await sut.GetSignalsForTrains([]);
        await sut.GetSignalsForTrains([]);

        sut.Loads.Should().Be(1);
    }

    [Fact]
    public async Task Invalidate_MakesNextRequestReadTheEdit()
    {
        var finalized = false;
        var sut = CreateService(() => Task.FromResult(new[] { Signal(finalized) }));

        (await sut.GetSignalsForTrains([])).Single().NextFinalized.Should().BeFalse();

        // admin finalizes the signal
        finalized = true;
        sut.InvalidateSignalsSnapshot();

        (await sut.GetSignalsForTrains([])).Single().NextFinalized.Should().BeTrue();
    }

    [Fact]
    public async Task LoadOverlappingAnEdit_DoesNotCacheOrReturnTheOldState()
    {
        var finalized = false;
        var firstLoadStarted = new TaskCompletionSource();
        var releaseFirstLoad = new TaskCompletionSource();
        var loads = 0;

        var sut = CreateService(async () =>
        {
            var snapshotOfDb = new[] { Signal(finalized) };
            if (Interlocked.Increment(ref loads) == 1)
            {
                // the first load read the database before the edit, and finishes after it
                firstLoadStarted.SetResult();
                await releaseFirstLoad.Task;
            }

            return snapshotOfDb;
        });

        var inFlight = sut.GetSignalsForTrains([]);
        await firstLoadStarted.Task;

        finalized = true;
        sut.InvalidateSignalsSnapshot();
        releaseFirstLoad.SetResult();

        (await inFlight).Single().NextFinalized.Should().BeTrue("the overlapping load is retried");
        (await sut.GetSignalsForTrains([])).Single().NextFinalized.Should().BeTrue("the old state was not cached");
    }

    private class FakeLoadService(
        ILogger<SignalAnalyzerService> logger,
        IServiceScopeFactory scopeFactory,
        Func<Task<SignalStatus[]>> loader)
        : SignalAnalyzerService(logger, scopeFactory)
    {
        public int Loads { get; private set; }

        protected override Task<SignalStatus[]> LoadSignalsFromDatabase()
        {
            Loads++;
            return loader();
        }
    }
}
