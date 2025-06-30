using NetTopologySuite.Geometries;

namespace SMOBackend.Models.OSM;

public class OSMCenter
{
    public double Lat { get; set; }
    public double Lon { get; set; }

    public Point Location => new Point(Lon, Lat);
}