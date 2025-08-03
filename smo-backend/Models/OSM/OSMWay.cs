namespace SMOBackend.Models.OSM;

public class OSMWay : OSMType
{
    public OSMCenter Center { get; set; }
    public long[] Nodes { get; set; } = [];
}