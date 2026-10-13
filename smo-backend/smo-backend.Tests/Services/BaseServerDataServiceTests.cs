using System.Reflection;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using SMOBackend.Models;
using SMOBackend.Services;

namespace SMOBackend.Tests.Services;

/// <summary>
///     Tests for the parallel per-server fetch of <see cref="BaseServerDataService{T}" />.
/// </summary>
public class BaseServerDataServiceTests
{
    private const string FailureMessage = "simulated SimRail failure (BaseServerDataServiceTests)";

    private static ServerDataService CreateServers(params string[] serverCodes)
    {
        var servers = new ServerDataService(new Mock<ILogger<ServerDataService>>().Object, null!,
            new Mock<IServiceScopeFactory>().Object, null!);

        // ServerDataService's Data is the one BaseTimeAlignedDataService re-declares (new)
        SetData(servers, typeof(BaseTimeAlignedDataService<ServerStatus[]>), serverCodes
            .Select(code => new ServerStatus { ServerCode = code, ServerName = code, ServerRegion = "EU", IsActive = true })
            .ToArray());

        return servers;
    }

    private static void SetData(object service, Type declaringType, object? data) =>
        declaringType.GetProperty("Data")!.SetValue(service, data);

    private static async Task<Dictionary<string, string>?> FetchData(FakeService sut) =>
        await (Task<Dictionary<string, string>>)typeof(BaseServerDataService<string>)
            .GetMethod("FetchData", BindingFlags.NonPublic | BindingFlags.Instance)!
            .Invoke(sut, [CancellationToken.None])!;

    [Fact]
    public async Task OneServerFailing_DoesNotStopTheOthers_AndKeepsItsLastData()
    {
        var sut = new FakeService(CreateServers("en1", "pl1", "de1"),
            code => code == "pl1" ? throw new HttpRequestException(FailureMessage) : $"new-{code}");
        SetData(sut, typeof(BaseDataService<Dictionary<string, string>>),
            new Dictionary<string, string> { ["en1"] = "old-en1", ["pl1"] = "old-pl1" });

        var emitted = new List<string>();
        sut.PerServerDataReceived += data => emitted.Add(data.ServerCode);

        var result = await FetchData(sut);

        result.Should().BeEquivalentTo(new Dictionary<string, string>
        {
            ["en1"] = "new-en1",
            ["de1"] = "new-de1",
            ["pl1"] = "old-pl1" // failed, last data kept
        });
        emitted.Should().BeEquivalentTo("en1", "de1");
    }

    [Fact]
    public async Task FailingServerWithoutPreviousData_IsLeftOut()
    {
        var sut = new FakeService(CreateServers("en1", "pl1"),
            code => code == "pl1" ? throw new HttpRequestException(FailureMessage) : $"new-{code}");

        var result = await FetchData(sut);

        result.Should().BeEquivalentTo(new Dictionary<string, string> { ["en1"] = "new-en1" });
    }

    [Fact]
    public async Task AllServersFailing_ReturnsNull_SoTheRunIsSkipped()
    {
        var sut = new FakeService(CreateServers("en1", "pl1"),
            _ => throw new HttpRequestException(FailureMessage));

        var result = await FetchData(sut);

        result.Should().BeNull();
    }

    [Fact]
    public async Task FailedFetch_IsNotReportedAsUnobservedTaskException()
    {
        var unobserved = new List<Exception>();
        EventHandler<UnobservedTaskExceptionEventArgs> handler = (_, e) =>
        {
            if (e.Exception.InnerExceptions.Any(x => x.Message == FailureMessage))
                lock (unobserved) unobserved.Add(e.Exception);
        };

        TaskScheduler.UnobservedTaskException += handler;
        try
        {
            for (var i = 0; i < 5; i++)
            {
                var sut = new FakeService(CreateServers("en1", "pl1"),
                    code => code == "pl1" ? throw new HttpRequestException(FailureMessage) : "ok");
                await FetchData(sut);
            }

            // unobserved task exceptions are raised when the faulted task is finalized
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();
        }
        finally
        {
            TaskScheduler.UnobservedTaskException -= handler;
        }

        unobserved.Should().BeEmpty();
    }

    [Fact]
    public void Indexer_ReturnsNull_ForUnknownServer()
    {
        var sut = new FakeService(CreateServers("en1"), _ => "x");
        SetData(sut, typeof(BaseDataService<Dictionary<string, string>>),
            new Dictionary<string, string> { ["en1"] = "data" });

        sut["en1"].Should().Be("data");
        sut["cz1"].Should().BeNull();
    }

    private sealed class FakeService(ServerDataService servers, Func<string, string> fetch)
        : BaseServerDataService<string>("TEST", new Mock<ILogger<BaseServerDataService<string>>>().Object,
            new Mock<IServiceScopeFactory>().Object, servers)
    {
        protected override TimeSpan FetchInterval => TimeSpan.FromSeconds(1);

        protected override async Task<string> FetchServerData(string serverCode, CancellationToken stoppingToken)
        {
            await Task.Yield(); // fail asynchronously, like a real request
            return fetch(serverCode);
        }
    }
}
