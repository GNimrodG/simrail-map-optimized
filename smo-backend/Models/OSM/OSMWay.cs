namespace SMOBackend.Models.OSM;

public class OSMWay : OSMType
{
    /// <summary>The way's centre ("out center" in the query)</summary>
    public OSMCenter? Center { get; set; }
    public long[] Nodes { get; set; } = [];
}