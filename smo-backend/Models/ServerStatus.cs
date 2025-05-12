// ReSharper disable InconsistentNaming
namespace SMOBackend.Models;

public class ServerStatus
{
    public string ServerCode { get; set; } = null!;
    public string ServerName { get; set; } = null!;
    public string ServerRegion { get; set; } = null!;
    public bool IsActive { get; set; }
    public string id { get; set; } = null!;
}