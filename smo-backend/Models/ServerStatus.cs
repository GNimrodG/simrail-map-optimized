// ReSharper disable InconsistentNaming

using Newtonsoft.Json;
using SMOBackend.Utils;

namespace SMOBackend.Models;

public class ServerStatus
{
    [JsonConverter(typeof(InterningStringConverter))]
    public string ServerCode { get; set; } = null!;

    [JsonConverter(typeof(InterningStringConverter))]
    public string ServerName { get; set; } = null!;

    [JsonConverter(typeof(InterningStringConverter))]
    public string ServerRegion { get; set; } = null!;

    public bool IsActive { get; set; }

    [JsonConverter(typeof(InterningStringConverter))]
    public string id { get; set; } = null!;
}