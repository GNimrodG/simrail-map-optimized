using System.Diagnostics;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Prometheus;
using SMOBackend.Utils;

namespace SMOBackend.Tests.Utils;

/// <summary>
///     Unit tests for <see cref="QueueProcessor{T}" />.
/// </summary>
public class QueueProcessorTests
{
    private readonly Mock<ILogger> _loggerMock = new();
    private readonly Gauge _testGauge = Metrics.CreateGauge($"test_gauge_{Guid.NewGuid():N}", "Test gauge");

    [Fact]
    public async Task Enqueue_ProcessesItem()
    {
        var processedItems = new List<int>();
        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            item =>
            {
                processedItems.Add(item);
                return Task.CompletedTask;
            },
            _testGauge);

        processor.Enqueue(42);

        // Give it time to process
        await Task.Delay(100);

        processedItems.Should().Contain(42);
    }

    [Fact]
    public async Task Enqueue_ProcessesMultipleItems_InOrder()
    {
        var processedItems = new List<int>();
        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            item =>
            {
                processedItems.Add(item);
                return Task.Delay(10); // Small delay to ensure order
            },
            _testGauge);

        processor.Enqueue(1);
        processor.Enqueue(2);
        processor.Enqueue(3);

        // Give it time to process all
        await Task.Delay(200);

        processedItems.Should().Equal(1, 2, 3);
    }

    [Fact]
    public async Task Enqueue_RemovesOldestItem_WhenQueueFull()
    {
        var processedItems = new List<int>();
        var startGate = new TaskCompletionSource<bool>();

        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            async item =>
            {
                // Wait for signal to start processing
                await startGate.Task;
                processedItems.Add(item);
                await Task.Delay(10); // Small delay between items
            },
            _testGauge,
            1,
            1); // Only 1 item in queue at a time

        // Queue up items - first item starts processing but blocks on gate
        processor.Enqueue(1);
        await Task.Delay(50); // Let it start processing

        // Now queue fills up
        processor.Enqueue(2);
        processor.Enqueue(3); // This should evict item 2 from queue (1 is processing, 3 replaces 2)

        // Release the gate and wait for processing
        startGate.SetResult(true);
        await Task.Delay(300);

        // Item 1 was already processing so it completes
        // Item 2 was evicted from queue
        // Item 3 processes
        processedItems.Should().Contain(1);
        processedItems.Should().NotContain(2); // This was evicted
        processedItems.Should().Contain(3);
    }

    [Fact]
    public async Task Enqueue_HandlesExceptionInProcessing()
    {
        var processedItems = new List<int>();
        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            item =>
            {
                if (item == 2)
                    throw new InvalidOperationException("Test exception");
                processedItems.Add(item);
                return Task.CompletedTask;
            },
            _testGauge);

        processor.Enqueue(1);
        processor.Enqueue(2); // This will throw
        processor.Enqueue(3);

        // Give it time to process
        await Task.Delay(200);

        // Items 1 and 3 should be processed, 2 should have failed
        processedItems.Should().Contain(1);
        processedItems.Should().NotContain(2);
        processedItems.Should().Contain(3);
    }

    [Fact]
    public async Task Enqueue_WithUnlimitedQueue_ProcessesAllItems()
    {
        var processedItems = new List<int>();
        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            item =>
            {
                processedItems.Add(item);
                return Task.CompletedTask;
            },
            _testGauge,
            maxQueueSize: -1); // Unlimited

        for (var i = 0; i < 100; i++) processor.Enqueue(i);

        // Give it time to process all
        await Task.Delay(500);

        processedItems.Should().HaveCount(100);
    }

    [Fact]
    public async Task ClearQueue_RemovesAllQueuedItems()
    {
        var processedItems = new List<int>();
        var processingGate = new TaskCompletionSource<bool>();

        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            async item =>
            {
                await processingGate.Task;
                processedItems.Add(item);
            },
            _testGauge);

        processor.Enqueue(1);
        await Task.Delay(50); // Let item 1 start processing

        processor.Enqueue(2);
        processor.Enqueue(3);

        processor.ClearQueue(); // Clears items 2 and 3 from queue

        // Release the gate
        processingGate.SetResult(true);
        await Task.Delay(100);

        // Only item 1 should be processed (was already processing)
        // Items 2 and 3 were cleared from queue
        processedItems.Should().HaveCount(1);
        processedItems.Should().Contain(1);
    }

    [Fact]
    public void Dispose_ClearsQueue()
    {
        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            _ => Task.CompletedTask,
            _testGauge);

        processor.Enqueue(1);
        processor.Enqueue(2);

        processor.Dispose();

        // Queue should be cleared (verified by no exceptions)
        var act = () => processor.Dispose();
        act.Should().NotThrow();
    }

    [Fact]
    public async Task Enqueue_WithParallelism_ProcessesMultipleItemsSimultaneously()
    {
        var processedItems = new List<int>();
        var processingCount = 0;
        var maxConcurrentProcessing = 0;
        var lockObj = new object();

        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            async item =>
            {
                lock (lockObj)
                {
                    processingCount++;
                    maxConcurrentProcessing = Math.Max(maxConcurrentProcessing, processingCount);
                }

                await Task.Delay(100); // Longer delay to ensure concurrency is measurable

                lock (lockObj)
                {
                    processedItems.Add(item);
                    processingCount--;
                }
            },
            _testGauge,
            3,
            -1); // Unlimited queue to avoid evictions

        for (var i = 0; i < 10; i++)
        {
            processor.Enqueue(i);
            await Task.Delay(10); // Small delay between enqueues
        }

        // Give it time to process - with 3 parallel, 10 items at 100ms each = ~400ms minimum
        await Task.Delay(800);

        processedItems.Should().HaveCount(10);
        maxConcurrentProcessing.Should().BeGreaterThan(1, "multiple items should be processed in parallel");
    }

    [Fact]
    public async Task Enqueue_DoesNotBlock_WhenProcessingIsActive()
    {
        var processingGate = new TaskCompletionSource<bool>();

        var processor = new QueueProcessor<int>(
            _loggerMock.Object,
            async _ => { await processingGate.Task; },
            _testGauge);

        // Enqueue first item (will start processing and block)
        processor.Enqueue(1);

        // This should return immediately without blocking
        var sw = Stopwatch.StartNew();
        processor.Enqueue(2);
        processor.Enqueue(3);
        sw.Stop();

        sw.ElapsedMilliseconds.Should().BeLessThan(50, "Enqueue should not block");

        // Cleanup
        processingGate.SetResult(true);
        await Task.Delay(100);
    }
}