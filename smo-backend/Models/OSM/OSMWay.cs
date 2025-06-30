namespace SMOBackend.Models.OSM;

public class OSMWay
{
    public string Type { get; set; } = "way";
    public long Id { get; set; }
    public OSMCenter Center { get; set; }
    public long[] Nodes { get; set; } = [];
    public Dictionary<string, string> Tags { get; set; } = new();
}