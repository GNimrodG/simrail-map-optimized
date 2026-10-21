using FluentAssertions;
using SMOBackend.Analytics;
using Edge = SMOBackend.Analytics.SpawnAnalyzerService.SpawnEdge;

namespace SMOBackend.Tests.Analytics;

public class SpawnAnalyzerServiceTests
{
    private static readonly DateTime Noon = new(2026, 10, 20, 12, 0, 0);

    [Fact]
    public void FindSpawnIndex_FindsTheFirstLearnedEdge()
    {
        // comes from off the map (A, B), spawns between B and C
        var timetable = Timetable("A", "B", "C", "D");
        var edges = Edges(Edge("B", "C"), Edge("C", "D"));

        var index = SpawnAnalyzerService.FindSpawnIndex(timetable, edges, out var edge);

        index.Should().Be(2);
        edge!.From.Should().Be("B");
    }

    [Fact]
    public void FindSpawnIndex_MatchesTheStartOfTheRun()
    {
        var timetable = Timetable("A", "B", "C");
        var edges = Edges(Edge(null, "A"), Edge("B", "C"));

        SpawnAnalyzerService.FindSpawnIndex(timetable, edges, out _).Should().Be(0);
    }

    [Fact]
    public void FindSpawnIndex_StartEdgeOnlyMatchesTheStart()
    {
        // trains starting at B spawn there, a train only passing B doesn't
        var timetable = Timetable("A", "B", "C");
        var edges = Edges(Edge(null, "B"));

        SpawnAnalyzerService.FindSpawnIndex(timetable, edges, out _).Should().Be(-1);
    }

    [Fact]
    public void FindSpawnIndex_EdgesHaveADirection()
    {
        // spawning from B towards C says nothing about trains running from C to B (they leave the map there)
        var timetable = Timetable("D", "C", "B", "A");
        var edges = Edges(Edge("B", "C"));

        SpawnAnalyzerService.FindSpawnIndex(timetable, edges, out _).Should().Be(-1);
    }

    [Fact]
    public void SpawnEdge_MedianOffset_IsRobustToOutliers()
    {
        var edge = new Edge { From = "A", To = "B" };
        foreach (var minutes in new[] { -2, -1, -1, 0, 45 })
            edge.Record(Noon, TimeSpan.FromMinutes(minutes));

        edge.Count.Should().Be(5);
        edge.MedianOffset().Should().Be(TimeSpan.FromMinutes(-1));
    }

    [Fact]
    public void SpawnEdge_WithoutOffsets_HasNoOffset()
    {
        var edge = new Edge { From = "A", To = "B" };
        edge.Record(Noon, null);

        edge.Count.Should().Be(1);
        edge.MedianOffset().Should().Be(TimeSpan.Zero);
    }

    [Fact]
    public void SpawnEdge_KeepsOnlyTheRecentOffsets()
    {
        var edge = new Edge { From = "A", To = "B" };
        for (var i = 0; i < 40; i++) edge.Record(Noon, TimeSpan.FromMinutes(10));
        for (var i = 0; i < 30; i++) edge.Record(Noon, TimeSpan.FromMinutes(1));

        edge.MedianOffset().Should().Be(TimeSpan.FromMinutes(1));
    }

    private static SpawnAnalyzerService.CompactTimetable Timetable(params string[] points) =>
        new("12345", "ROJ", points[0], points[^1], "EN57", 65, 130, points, points.Select(_ => "RPJ").ToArray(),
            points.Select((_, i) => Noon.AddMinutes(i * 5)).ToArray());

    private static Edge Edge(string? from, string to) => new() { From = from, To = to, Count = 5 };

    private static Dictionary<string, Edge> Edges(params Edge[] edges) =>
        edges.ToDictionary(e => SpawnAnalyzerService.EdgeKey(e.From, e.To));
}
