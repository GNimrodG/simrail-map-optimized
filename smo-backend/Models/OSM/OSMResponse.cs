namespace SMOBackend.Models.OSM;

public class OSMResponse
{
    public float Version { get; set; }
    public string Generator { get; set; }
    public OSMType[] Elements { get; set; }
}