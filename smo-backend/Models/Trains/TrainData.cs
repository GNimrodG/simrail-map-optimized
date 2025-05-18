// ReSharper disable InconsistentNaming

using Newtonsoft.Json;
using MessagePack;
using NetTopologySuite.Geometries;

namespace SMOBackend.Models.Trains;

[MessagePackObject(keyAsPropertyName: true)]
public class TrainData : BaseTrainData
{
    [JsonProperty(nameof(ControlledBySteamID))]
    public string? ControlledBySteamID { get; set; }

    [JsonProperty(nameof(InBorderStationArea))]
    public bool InBorderStationArea { get; set; }

    /// <summary>
    /// The longitude of the train.
    /// </summary>
    // ReSharper disable once StringLiteralTypo
    [JsonProperty("Latititute")] public double? Latitude { get; set; }

    /// <summary>
    /// The longitude of the train.
    /// </summary>
    // ReSharper disable once StringLiteralTypo
    [JsonProperty("Longitute")] public double? Longitude { get; set; }

    [JsonProperty(nameof(VDDelayedTimetableIndex))]
    public byte VDDelayedTimetableIndex { get; set; }

    [JsonProperty(nameof(RequiredMapDLCs))] public uint[][]? RequiredMapDLCs { get; set; }

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