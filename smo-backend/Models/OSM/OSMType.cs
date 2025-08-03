using System.Text.Json.Serialization;

namespace SMOBackend.Models.OSM;

[JsonConverter(typeof(OsmTypeConverter))]
public abstract class OSMType
{
    public string Type { get; set; }
    public long Id { get; set; }
    public Dictionary<string, string> Tags { get; set; } = new();
}