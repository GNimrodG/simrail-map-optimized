using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using SMOBackend.Analytics;
using SMOBackend.Services;
using SMOBackend.Services.ApiClients;

namespace SMOBackend.Tests.Analytics;

public class TrainDelayAnalyzerServiceTests
{
    [Fact]
    public async Task StartAsync_CompletesWithoutInitialTimeData()
    {
        var scopeFactory = Mock.Of<IServiceScopeFactory>();
        using var apiClient = new SimrailApiClient(Mock.Of<ILogger<SimrailApiClient>>());
        var serverDataService = new ServerDataService(
            Mock.Of<ILogger<ServerDataService>>(),
            Mock.Of<IServiceProvider>(),
            scopeFactory,
            apiClient);
        var timeDataService = new TimeDataService(
            Mock.Of<ILogger<TimeDataService>>(),
            scopeFactory,
            serverDataService,
            apiClient);
        var timetableDataService = new TimetableDataService(
            Mock.Of<ILogger<TimetableDataService>>(),
            scopeFactory,
            serverDataService,
            apiClient);
        var trainTypeService = new TrainTypeService(
            Mock.Of<ILogger<TrainTypeService>>(),
            timetableDataService);
        var trainDataService = new TrainDataService(
            Mock.Of<ILogger<TrainDataService>>(),
            scopeFactory,
            serverDataService,
            apiClient,
            trainTypeService);
        var sut = new TrainDelayAnalyzerService(
            Mock.Of<ILogger<TrainDelayAnalyzerService>>(),
            scopeFactory,
            timeDataService,
            trainDataService,
            timetableDataService);

        try
        {
            await sut.StartAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(5));

            timeDataService.FirstDataReceived.IsCompleted.Should().BeFalse();
        }
        finally
        {
            await sut.StopAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(5));
        }
    }
}
