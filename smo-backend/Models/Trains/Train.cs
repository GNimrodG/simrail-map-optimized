using System.Text.Json.Serialization;
using MessagePack;

namespace SMOBackend.Models.Trains;

[MessagePackObject(keyAsPropertyName: true)]
public class Train
{
    [JsonPropertyName("TrainNoLocal")] public required string TrainNoLocal { get; set; }
    [JsonPropertyName("TrainName")] public required string TrainName { get; set; }
    [JsonPropertyName("StartStation")] public required string StartStation { get; set; }
    [JsonPropertyName("EndStation")] public required string EndStation { get; set; }
    [JsonPropertyName("Vehicles")] public required string[] Vehicles { get; set; }
    [JsonPropertyName("ServerCode")] public required string ServerCode { get; set; }

    [JsonPropertyName("TrainData")] public required TrainData TrainData { get; set; }

    [JsonPropertyName("RunId")] public required string RunId { get; set; }
    [JsonPropertyName("id")] public required string Id { get; set; }
    [JsonPropertyName("Type")] public required string Type { get; set; }

    /// <summary>
    /// Gets the train ID in the format "TrainNoLocal@ServerCode-Id".
    /// </summary>
    public string GetTrainId() => $"{TrainNoLocal}@{ServerCode}-{Id}";

    /// <inheritdoc />
    public override string ToString() => GetTrainId() +
                                         (!string.IsNullOrEmpty(TrainData.SignalInFront)
                                             ? $" at {TrainData.SignalInFront}"
                                             : string.Empty);

    public class PartialTrainData
    {
        public string Id { get; set; }

        public string Type { get; set; }
        public double Velocity { get; set; }
        public string? SignalInFront { get; set; }
        public double DistanceToSignalInFront { get; set; }
        public short SignalInFrontSpeed { get; set; }
        public string? ControlledBySteamID { get; set; }
        public bool InBorderStationArea { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public byte VDDelayedTimetableIndex { get; set; }
        public uint[][]? RequiredMapDLCs { get; set; }
        
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
            ControlledBySteamID = train.TrainData.ControlledBySteamID;
            InBorderStationArea = train.TrainData.InBorderStationArea;
            Latitude = train.TrainData.Latitude;
            Longitude = train.TrainData.Longitude;
            VDDelayedTimetableIndex = train.TrainData.VDDelayedTimetableIndex;
            RequiredMapDLCs = train.TrainData.RequiredMapDLCs;
        }
    }
}