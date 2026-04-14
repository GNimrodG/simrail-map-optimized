using System.Globalization;
using System.Reflection;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using SMOBackend.Analytics;
using SMOBackend.Models;
using SMOBackend.Services;
using SMOBackend.Services.ApiClients;
using SMOBackend.Utils;

namespace SMOBackend.Tests.Analytics;

public class ServerRestartAnalyzerServiceTests
{
    [Fact]
    public void OnServerDataReceived_TracksTransitionsAndRecordsRestart()
    {
        var sut = CreateService();

        InvokeOnServerDataReceived(sut, [new() { ServerCode = "en1", IsActive = true }]);
        InvokeOnServerDataReceived(sut, [new() { ServerCode = "en1", IsActive = false }]);
        InvokeOnServerDataReceived(sut, [new() { ServerCode = "en1", IsActive = true }]);

        var restarts = sut.GetServerRestarts("en1");
        restarts.Should().HaveCount(1);
        restarts[0].ShutdownTime.Should().NotBeNull();
        restarts[0].RestartTime.Should().BeAfter(restarts[0].ShutdownTime!.Value);

        var prediction = sut.GetNextRestartPrediction("en1");
        prediction.Confidence.Should().BeNull();
    }

    [Fact]
    public void PredictNextRestart_ReturnsFutureTime_WhenLastPredictionIsInThePast()
    {
        var sut = CreateService();
        var now = DateTime.UtcNow;

        var restartHistory = new[]
        {
            new ServerRestartAnalyzerService.ServerRestartData(now.AddHours(-8), now.AddHours(-6)),
            new ServerRestartAnalyzerService.ServerRestartData(now.AddHours(-4), now.AddHours(-2))
        };

        var restartCache = GetPrivateField<TtlCache<string, ServerRestartAnalyzerService.ServerRestartData[]>>(sut,
            "_serverRestartTimes");
        restartCache["en1"] = restartHistory;

        var prediction = sut.PredictNextRestart("en1");

        prediction.Should().NotBeNull();
        prediction.Value.Should().BeAfter(now);
    }

    [Fact]
    public void CsvReplay_TracksExpectedRestartCounts_AndPredictionAvailability()
    {
        var sut = CreateService();

        var csvPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..",
            "smo-backend.Tests", "Analytics", "TestData", "server-status-7d.csv"));

        var (serverCodes, snapshots) = LoadSnapshots(csvPath);

        var expectedRestartCounts = serverCodes.ToDictionary(code => code, _ => 0);
        var lastState = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        foreach (var snapshot in snapshots.OrderBy(s => s.TimestampUtc))
        {
            var serverData = serverCodes
                .Select(serverCode => new ServerStatus
                {
                    ServerCode = serverCode,
                    ServerName = serverCode,
                    ServerRegion = "test",
                    id = serverCode,
                    IsActive = snapshot.Statuses[serverCode]
                })
                .ToArray();

            foreach (var serverCode in serverCodes)
            {
                var current = snapshot.Statuses[serverCode];
                if (lastState.TryGetValue(serverCode, out var previous) && !previous && current)
                    expectedRestartCounts[serverCode]++;

                lastState[serverCode] = current;
            }

            InvokeOnServerDataReceived(sut, serverData);
        }

        foreach (var serverCode in serverCodes)
        {
            var recorded = sut.GetServerRestarts(serverCode);
            recorded.Length.Should().Be(expectedRestartCounts[serverCode], "CSV replay transitions should match");

            if (expectedRestartCounts[serverCode] >= 2)
                sut.PredictNextRestart(serverCode).Should().NotBeNull();
            else
                sut.PredictNextRestart(serverCode).Should().BeNull();

            var restartData = sut.GetRestartData(serverCode);
            restartData.PrevStatus.Should().Be(lastState[serverCode]);
            if (lastState[serverCode])
                restartData.LastShutdown.Should().BeNull();
            else
                restartData.LastShutdown.Should().NotBeNull();
        }
    }

    [Fact]
    public void PredictNextRestart_PrefersStrongTimeOfDayPattern_WhenAvailable()
    {
        var sut = CreateService();

        var restartCache = GetPrivateField<TtlCache<string, ServerRestartAnalyzerService.ServerRestartData[]>>(sut,
            "_serverRestartTimes");

        restartCache["en1"] =
        [
            new(null, new(2026, 4, 8, 1, 28, 0, DateTimeKind.Utc)),
            new(null, new(2026, 4, 8, 9, 28, 0, DateTimeKind.Utc)),
            new(null, new(2026, 4, 9, 1, 28, 0, DateTimeKind.Utc)),
            new(null, new(2026, 4, 9, 9, 28, 0, DateTimeKind.Utc)),
            new(null, new(2026, 4, 10, 1, 28, 0, DateTimeKind.Utc))
        ];

        var now = new DateTime(2026, 4, 10, 2, 0, 0, DateTimeKind.Utc);

        var prediction = sut.PredictNextRestart("en1", now);

        prediction.Should().Be(new(2026, 4, 10, 9, 30, 0, DateTimeKind.Utc));

        var predictionWithConfidence = sut.GetNextRestartPrediction("en1");
        predictionWithConfidence.Confidence.Should().NotBeNull();
        predictionWithConfidence.Confidence!.Value.Should().BeInRange(0, 1);
    }

    private static ServerRestartAnalyzerService CreateService()
    {
        var apiClientLogger = Mock.Of<ILogger<SimrailApiClient>>();
        var apiClient = new SimrailApiClient(apiClientLogger);

        var serverDataService = new ServerDataService(
            Mock.Of<ILogger<ServerDataService>>(),
            Mock.Of<IServiceProvider>(),
            Mock.Of<IServiceScopeFactory>(),
            apiClient);

        return new(Mock.Of<ILogger<ServerRestartAnalyzerService>>(), serverDataService);
    }

    private static void InvokeOnServerDataReceived(ServerRestartAnalyzerService sut, ServerStatus[] data)
    {
        var method = typeof(ServerRestartAnalyzerService)
            .GetMethod("OnServerDataReceived", BindingFlags.NonPublic | BindingFlags.Instance)!;

        method.Invoke(sut, [data]);
    }

    private static T GetPrivateField<T>(object instance, string fieldName)
    {
        var field = instance.GetType().GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Instance)!;
        return (T)field.GetValue(instance)!;
    }

    private static (string[] serverCodes, List<CsvSnapshot> snapshots) LoadSnapshots(string path)
    {
        var lines = File.ReadAllLines(path)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToArray();

        var header = lines[0].Split(',').Select(x => x.Trim('"')).ToArray();
        var serverCodes = header.Skip(1).ToArray();

        var snapshots = new List<CsvSnapshot>();

        foreach (var line in lines.Skip(1))
        {
            var parts = line.Split(',');
            if (parts.Length != header.Length)
                continue;

            var timestamp = DateTime.ParseExact(parts[0].Trim('"'), "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);

            var statuses = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
            for (var i = 1; i < parts.Length; i++)
                statuses[header[i].Trim('"')] = parts[i].Trim().Equals("Online", StringComparison.OrdinalIgnoreCase);

            snapshots.Add(new(timestamp, statuses));
        }

        return (serverCodes, snapshots);
    }

    private sealed record CsvSnapshot(DateTime TimestampUtc, Dictionary<string, bool> Statuses);
}