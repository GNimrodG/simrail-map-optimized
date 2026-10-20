using System.Globalization;
using System.Reflection;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Newtonsoft.Json;
using SMOBackend.Analytics;
using SMOBackend.Models;
using SMOBackend.Services;
using SMOBackend.Services.ApiClients;
using SMOBackend.Utils;
using Xunit.Abstractions;
using RestartData = SMOBackend.Analytics.ServerRestartAnalyzerService.ServerRestartData;

namespace SMOBackend.Tests.Analytics;

public class ServerRestartAnalyzerServiceTests(ITestOutputHelper output)
{
    private static readonly TimeZoneInfo Warsaw = TimeZoneInfo.FindSystemTimeZoneById("Europe/Warsaw");

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
    public void OnServerDataReceived_DropsRestartsOlderThan90Days()
    {
        var sut = CreateService();
        var now = DateTime.UtcNow;
        GetRestartCache(sut)["en1"] =
        [
            new(now.AddDays(-100).AddMinutes(-2), now.AddDays(-100)),
            new(now.AddDays(-10).AddMinutes(-2), now.AddDays(-10))
        ];

        InvokeOnServerDataReceived(sut, [new() { ServerCode = "en1", IsActive = true }]);
        InvokeOnServerDataReceived(sut, [new() { ServerCode = "en1", IsActive = false }]);
        InvokeOnServerDataReceived(sut, [new() { ServerCode = "en1", IsActive = true }]);

        var restarts = sut.GetServerRestarts("en1");
        restarts.Should().HaveCount(2);
        restarts.Should().OnlyContain(r => r.RestartTime > now.AddDays(-90));
    }

    [Fact]
    public void CsvReplay_TracksExpectedRestartCounts()
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

            var restartData = sut.GetRestartData(serverCode);
            restartData.PrevStatus.Should().Be(lastState[serverCode]);
            if (lastState[serverCode])
                restartData.LastShutdown.Should().BeNull();
            else
                restartData.LastShutdown.Should().NotBeNull();
        }
    }

    [Fact]
    public void PredictFromHistory_DailySlot_PredictsNextOccurrenceWithFullConfidence()
    {
        var history = Daily(new(2026, 9, 21), new(2026, 10, 19), 9, 30);

        // 10:00 in Warsaw (CEST), today's restart is over
        var prediction = Predict(history, new(2026, 10, 20, 8, 0, 0, DateTimeKind.Utc));

        prediction.Time.Should().Be(new DateTime(2026, 10, 21, 7, 30, 0, DateTimeKind.Utc));
        prediction.Confidence.Should().Be(1);
    }

    [Fact]
    public void PredictFromHistory_FollowsTheLocalTimeOverTheDstChange()
    {
        var history = Daily(new(2026, 9, 26), new(2026, 10, 24), 9, 30);

        // 25 October: the clocks go back, 09:30 in Warsaw is 08:30 UTC from now on instead of 07:30
        var prediction = Predict(history, new(2026, 10, 25, 6, 0, 0, DateTimeKind.Utc));

        prediction.Time.Should().Be(new DateTime(2026, 10, 25, 8, 30, 0, DateTimeKind.Utc));
    }

    [Fact]
    public void PredictFromHistory_WeekdayOnlySlot_IsNotPredictedOnWeekends()
    {
        var weekdaysOnly = Daily(new(2026, 9, 21), new(2026, 10, 16), 2, 48)
            .Where(r => TimeZoneInfo.ConvertTimeFromUtc(r.RestartTime, Warsaw).DayOfWeek is not
                (DayOfWeek.Saturday or DayOfWeek.Sunday));
        var history = weekdaysOnly.Concat(Daily(new(2026, 9, 21), new(2026, 10, 16), 9, 30)).ToArray();

        // Friday 16 October 20:00 in Warsaw, the next restart is Saturday 09:30, not 02:48
        var prediction = Predict(history, Local(2026, 10, 16, 20, 0));

        prediction.Time.Should().Be(Local(2026, 10, 17, 9, 30));
    }

    [Fact]
    public void PredictFromHistory_DoubleRestarts_CountAsOne()
    {
        var history = Daily(new(2026, 9, 21), new(2026, 10, 19), 9, 30)
            .Concat(Daily(new(2026, 9, 21), new(2026, 10, 19), 9, 36))
            .ToArray();

        var prediction = Predict(history, Local(2026, 10, 20, 12, 0));

        prediction.Time.Should().Be(Local(2026, 10, 21, 9, 30));
        prediction.Confidence.Should().Be(1);
    }

    [Fact]
    public void PredictFromHistory_SkipsTheSlotWhenTodaysRestartAlreadyHappened()
    {
        var history = Daily(new(2026, 9, 21), new(2026, 10, 19), 9, 30)
            .Append(Restart(Local(2026, 10, 20, 9, 24)))
            .ToArray();

        // 09:29, a minute before the usual time, but the restart came early today
        var prediction = Predict(history, Local(2026, 10, 20, 9, 29));

        prediction.Time.Should().Be(Local(2026, 10, 21, 9, 30));
    }

    [Fact]
    public void PredictFromHistory_IrregularRestarts_HaveNoPrediction()
    {
        var random = new Random(42);
        var history = Enumerable.Range(0, 28)
            .Select(day => Restart(Local(2026, 9, 21, 0, 0).AddDays(day).AddMinutes(random.Next(0, 24 * 60))))
            .ToArray();

        var prediction = Predict(history, Local(2026, 10, 20, 12, 0));

        prediction.Time.Should().BeNull();
        prediction.Confidence.Should().BeNull();
    }

    [Fact]
    public void PredictFromHistory_TooShortHistory_HasNoPrediction()
    {
        var history = Daily(new(2026, 10, 15), new(2026, 10, 19), 9, 30);

        Predict(history, Local(2026, 10, 20, 12, 0)).Time.Should().BeNull();
    }

    /// <summary>
    ///     Replays 8 weeks of real restarts: every hour of the last 3 weeks, the shown prediction (confidence ≥ 0.9)
    ///     must match the next real restart within 15 minutes at least 90% of the time.
    /// </summary>
    [Fact]
    public void PredictFromHistory_RealHistory_HighConfidencePredictionsAreAccurate()
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..",
            "smo-backend.Tests", "Analytics", "TestData", "server-restarts-56d.json"));
        var servers = JsonConvert.DeserializeObject<Dictionary<string, DateTime?[][]>>(File.ReadAllText(path),
            new JsonSerializerSettings { DateTimeZoneHandling = DateTimeZoneHandling.Utc })!;

        int shown = 0, correct = 0, hours = 0, early = 0, late = 0;
        foreach (var (server, rows) in servers)
        {
            var history = rows.Select(r => new RestartData(r[0], r[1]!.Value)).OrderBy(r => r.RestartTime).ToArray();
            var end = history[^1].RestartTime;
            int serverShown = 0, serverCorrect = 0, serverHours = 0;

            for (var now = end.AddDays(-21); now < end.AddHours(-12); now = now.AddHours(1))
            {
                serverHours++;
                var prediction = ServerRestartAnalyzerService.PredictFromHistory(history, now);
                if (prediction.Confidence is not >= 0.9) continue;

                serverShown++;
                var actual = history.First(r => r.RestartTime > now).RestartTime;
                var error = actual - prediction.Time!.Value;
                if (error.Duration() <= TimeSpan.FromMinutes(15)) serverCorrect++;
                else if (error < TimeSpan.Zero) early++; // an unexpected restart before the predicted one
                else late++; // the predicted restart didn't happen
            }

            output.WriteLine(
                $"{server}: shown {serverShown}/{serverHours} hours, correct {serverCorrect} ({(double)serverCorrect / Math.Max(1, serverShown):P1})");
            shown += serverShown;
            correct += serverCorrect;
            hours += serverHours;
        }

        output.WriteLine(
            $"all: shown {shown}/{hours} hours, correct {correct} ({(double)correct / shown:P1}), missed: {early} earlier restart, {late} predicted restart didn't happen");

        // a prediction is confident enough when the next restart is a few hours away (random restarts make longer
        // predictions uncertain), on the real data that's about a third of the time
        shown.Should().BeGreaterThan(hours / 4, "the regular restarts should be predicted");
        ((double)correct / shown).Should().BeGreaterThanOrEqualTo(0.9);
    }

    private static ServerRestartAnalyzerService.PredictionResult Predict(IEnumerable<RestartData> history,
        DateTime nowUtc) =>
        ServerRestartAnalyzerService.PredictFromHistory(history, nowUtc);

    /// <summary>
    ///     A restart every day from <paramref name="from" /> to <paramref name="to" /> at the given time in Warsaw.
    /// </summary>
    private static RestartData[] Daily(DateOnly from, DateOnly to, int hour, int minute)
    {
        var restarts = new List<RestartData>();
        for (var day = from; day <= to; day = day.AddDays(1))
            restarts.Add(Restart(Local(day.Year, day.Month, day.Day, hour, minute)));
        return restarts.ToArray();
    }

    private static RestartData Restart(DateTime restartUtc) => new(restartUtc.AddMinutes(-2), restartUtc);

    /// <summary>
    ///     A time in Warsaw as UTC.
    /// </summary>
    private static DateTime Local(int year, int month, int day, int hour, int minute) =>
        TimeZoneInfo.ConvertTimeToUtc(new(year, month, day, hour, minute, 0, DateTimeKind.Unspecified), Warsaw);

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

    private static TtlCache<string, RestartData[]> GetRestartCache(ServerRestartAnalyzerService sut) =>
        GetPrivateField<TtlCache<string, RestartData[]>>(sut, "_serverRestartTimes");

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
