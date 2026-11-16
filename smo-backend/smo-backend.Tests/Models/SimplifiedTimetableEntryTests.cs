using FluentAssertions;
using SMOBackend.Models;
using SMOBackend.Utils;

namespace SMOBackend.Tests.Models;

/// <summary>
///     Unit tests for <see cref="SimplifiedTimetableEntry" />.
/// </summary>
public class SimplifiedTimetableEntryTests
{
    private static Timetable CreateTimetable() => new()
    {
        TrainNoLocal = "40601",
        TrainNoInternational = "40601",
        TrainName = "ROJ",
        StartStation = "Katowice",
        StartsAt = "04:00:00",
        EndStation = "Częstochowa",
        EndsAt = "05:00:00",
        LocoType = "EN57",
        TrainLength = 60,
        TrainWeight = 100,
        ContinuesAs = "",
        TimetableEntries =
        [
            CreateEntry("Wiesiółka", null, "2026-11-16 04:20:00"),
            CreateEntry("Chruszczobród", "2026-11-16 04:29:06", "2026-11-16 04:29:36"),
            CreateEntry("Dąbrowa Górnicza Sikorka", "2026-11-16 04:35:00", null),
        ],
    };

    private static TimetableEntry CreateEntry(string name, string? arrival, string? departure) => new()
    {
        NameOfPoint = name,
        NameForPerson = name,
        PointId = "1",
        SupervisedBy = "Katowice",
        RadioChannels = "R1",
        DisplayedTrainNumber = "40601",
        ArrivalTime = arrival,
        DepartureTime = departure,
        StopType = EStopType.CommercialStop,
        Line = 1,
        Platform = "I",
        Track = 1,
        TrainType = "ROJ",
        Mileage = 1.5,
        MaxSpeed = 120,
        StationCategory = EStationCategory.E,
    };

    [Fact]
    public async Task SurvivesTheCacheFile()
    {
        // the timetable analyzer saves its station timetables to a file and loads them back after a restart
        var entry = new SimplifiedTimetableEntry(CreateTimetable(), 1, ["EN57/EN71-005"])
            .WithUnusualCargo(UnusualCargo.DangerousCargo);
        var file = Path.Combine(Path.GetTempPath(), $"timetable-cache-{Guid.NewGuid():N}.bin");

        try
        {
            using (var cache = new TtlCache<string, Dictionary<string, SimplifiedTimetableEntry[]>>(
                       TimeSpan.FromMinutes(5)))
            {
                cache.Set("cz1", new() { ["Chruszczobród"] = [entry] });
                await cache.SaveToFileAsync(file);
            }

            using var loaded = new TtlCache<string, Dictionary<string, SimplifiedTimetableEntry[]>>(
                TimeSpan.FromMinutes(5));
            loaded.LoadFromFile(file);

            loaded.TryGetValue("cz1", out var stations).Should().BeTrue();
            var restored = stations!["Chruszczobród"].Should().ContainSingle().Subject;
            restored.Should().BeEquivalentTo(entry, options => options.ComparingByMembers<SimplifiedTimetableEntry>()
                .ComparingByMembers<SimplifiedTimetableEntry.TrainTypeCode>());
            restored.TrainType.ToString().Should().Be("ROJ");
            restored.SupervisedBy.Should().Be("Katowice");
        }
        finally
        {
            File.Delete(file);
        }
    }
}
