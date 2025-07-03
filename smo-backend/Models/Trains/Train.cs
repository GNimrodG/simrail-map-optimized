using JetBrains.Annotations;
using MessagePack;
using Newtonsoft.Json;
using SMOBackend.Models.Entity;
using SMOBackend.Utils;

namespace SMOBackend.Models.Trains;

/// <summary>
/// Represents a train in the game.
/// </summary>
[MessagePackObject(keyAsPropertyName: true)]
public class Train : IEntityWithTimestamp
{
    [JsonProperty(nameof(TrainNoLocal))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string TrainNoLocal { get; set; }

    [JsonProperty(nameof(TrainName))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string TrainName { get; set; }

    [JsonProperty(nameof(StartStation))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string StartStation { get; set; }

    [JsonProperty(nameof(EndStation))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string EndStation { get; set; }

    [JsonProperty(nameof(Vehicles))]
    [JsonConverter(typeof(InterningStringArrayConverter))]
    public required string[] Vehicles { get; set; }

    [JsonProperty(nameof(ServerCode))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string ServerCode { get; set; }

    [JsonProperty(nameof(TrainData))] public required TrainData TrainData { get; set; }

    /// <summary>
    /// The id of the run.
    /// </summary>
    [JsonProperty(nameof(RunId))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string RunId { get; set; }

    /// <summary>
    /// The id of the train.
    /// </summary>
    [JsonProperty("id")]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string Id { get; set; }

    /// <summary>
    /// The type of the train, either "bot" or "player".
    /// </summary>
    [JsonProperty(nameof(Type))]
    [JsonConverter(typeof(InterningStringConverter))]
    public required string Type { get; set; }

    /// <inheritdoc />
    [JsonIgnore]
    public DateTime Timestamp { get; set; }

    /// <summary>
    /// Gets the train ID in the format "TrainNoLocal@ServerCode-Id".
    /// </summary>
    public string GetTrainId() => $"{TrainNoLocal}@{ServerCode}-{Id}";

    /// <inheritdoc />
    public override string ToString() => GetTrainId() +
                                         (!string.IsNullOrEmpty(TrainData.SignalInFront)
                                             ? $" at {TrainData.SignalInFront}"
                                             : string.Empty);

    /// <summary>
    /// Partial train data, the data that changes frequently.
    /// </summary>
    public class PartialTrainData
    {
        /// <inheritdoc cref="Train.Id"/>
        public string Id { get; set; }

        /// <inheritdoc cref="Train.Type"/>
        public string Type { get; set; }

        /// <inheritdoc cref="TrainData.Velocity"/>
        public double Velocity { get; set; }

        /// <inheritdoc cref="TrainData.SignalInFront"/>
        public string? SignalInFront { get; set; }

        /// <inheritdoc cref="TrainData.DistanceToSignalInFront"/>
        public double DistanceToSignalInFront { get; set; }

        /// <inheritdoc cref="TrainData.SignalInFrontSpeed"/>
        public short SignalInFrontSpeed { get; set; }

        /// <inheritdoc cref="TrainData.ControlledBySteamID"/>
        [JsonProperty("ControlledBySteamID")]
        public string? ControlledBySteamId { get; set; }

        /// <inheritdoc cref="TrainData.InBorderStationArea"/>
        public bool InBorderStationArea { get; set; }

        /// <inheritdoc cref="TrainData.Latitude"/>
        public double? Latitude { get; set; }

        /// <inheritdoc cref="TrainData.Longitude"/>
        public double? Longitude { get; set; }

        /// <inheritdoc cref="TrainData.VDDelayedTimetableIndex"/>
        [JsonProperty("VDDelayedTimetableIndex")]
        public byte VdDelayedTimetableIndex { get; set; }

        /// <inheritdoc cref="TrainData.RequiredMapDLCs"/>
        [JsonProperty("RequiredMapDLCs")]
        public uint[][]? RequiredMapDlCs { get; set; }

        public PartialTrainData()
        {
        }

        public PartialTrainData(Train train)
        {
            Id = train.Id;
            Type = train.Type;
            Velocity = train.TrainData.Velocity;
            SignalInFront = train.TrainData.GetSignal();
            DistanceToSignalInFront = train.TrainData.DistanceToSignalInFront;
            SignalInFrontSpeed = train.TrainData.SignalInFrontSpeed;
            ControlledBySteamId = train.TrainData.ControlledBySteamID;
            InBorderStationArea = train.TrainData.InBorderStationArea;
            Latitude = train.TrainData.Latitude;
            Longitude = train.TrainData.Longitude;
            VdDelayedTimetableIndex = train.TrainData.VDDelayedTimetableIndex;
            RequiredMapDlCs = train.TrainData.RequiredMapDLCs;
        }
    }
}