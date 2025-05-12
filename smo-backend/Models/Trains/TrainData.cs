// ReSharper disable InconsistentNaming

using System.Text.Json.Serialization;
using MessagePack;
using NetTopologySuite.Geometries;

namespace SMOBackend.Models.Trains;

[MessagePackObject(keyAsPropertyName: true)]
public class TrainData : BaseTrainData
{
    [JsonPropertyName("ControlledBySteamID")]
    public string? ControlledBySteamID { get; set; }

    [JsonPropertyName("InBorderStationArea")]
    public bool InBorderStationArea { get; set; }

    // ReSharper disable once StringLiteralTypo
    [JsonPropertyName("Latititute")] public double? Latitude { get; set; }

    // ReSharper disable once StringLiteralTypo
    [JsonPropertyName("Longitute")] public double? Longitude { get; set; }

    [JsonPropertyName("VDDelayedTimetableIndex")]
    public byte VDDelayedTimetableIndex { get; set; }

    [JsonPropertyName("RequiredMapDLCs")] public uint[][]? RequiredMapDLCs { get; set; }

    [JsonIgnore, IgnoreMember]
    public Point? Location
    {
        get
        {
            if (Longitude != null && Latitude != null) return new(Longitude.Value, Latitude.Value) { SRID = 4326 };

            return null;
        }
    }

    public string? GetSignal()
    {
        if (string.IsNullOrEmpty(SignalInFront)) return null;

        var parts = SignalInFront.Split('@');

        return parts[0];
    }

    [JsonIgnore, IgnoreMember]
    public static readonly uint LODZ_DLC_ID = 3583200;
}