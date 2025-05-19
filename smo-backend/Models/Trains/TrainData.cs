// ReSharper disable InconsistentNaming

using Newtonsoft.Json;
using MessagePack;
using NetTopologySuite.Geometries;

namespace SMOBackend.Models.Trains;

/// <summary>
/// Represents a train in the game.
/// </summary>
[MessagePackObject(keyAsPropertyName: true)]
public class TrainData : BaseTrainData
{
    internal Point? OriginalLocation { get; set; }
    
    /// <summary>
    /// The Steam ID of the player controlling the train.
    /// </summary>
    [JsonProperty(nameof(ControlledBySteamID))]
    public string? ControlledBySteamID { get; set; }

    /// <summary>
    /// Whether the train is in the playable area of the map.
    /// </summary>
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

    /// <summary>
    /// The index of the next station in the train's timetable.
    /// </summary>
    /// <remarks>
    /// This only update when the train leaves the station, so it may be a little bit behind.
    /// </remarks>
    [JsonProperty(nameof(VDDelayedTimetableIndex))]
    public byte VDDelayedTimetableIndex { get; set; }

    /// <summary>
    /// The required map DLCs for the train.
    /// </summary>
    [JsonProperty(nameof(RequiredMapDLCs))] public uint[][]? RequiredMapDLCs { get; set; }

    [JsonIgnore, IgnoreMember]
    internal Point? Location
    {
        get
        {
            if (OriginalLocation != null) return OriginalLocation;
            if (Longitude != null && Latitude != null) return new(Longitude.Value, Latitude.Value) { SRID = 4326 };

            return null;
        }
    }

    /// <summary>
    /// Gets the signal in front of the train without the extra information.
    /// </summary>
    public string? GetSignal()
    {
        if (string.IsNullOrEmpty(SignalInFront)) return null;

        var parts = SignalInFront.Split('@');

        return parts[0];
    }

    [JsonIgnore, IgnoreMember]
    public static readonly uint LODZ_DLC_ID = 3583200;
}