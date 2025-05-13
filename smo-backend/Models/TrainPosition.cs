using System.Text.Json.Serialization;
using SMOBackend.Models.Trains;

namespace SMOBackend.Models;

public class TrainPosition
{
    [JsonPropertyName("id")] public required string Id { get; set; }
    
    [JsonPropertyName("Latitude")] public double? Latitude { get; set; }

    [JsonPropertyName("Longitude")] public double? Longitude { get; set; }
    
    [JsonPropertyName("Velocity")] public required double Velocity { get; set; }
    
    public void ApplyTo(Train train)
    {
        if (Latitude.HasValue)
            train.TrainData.Latitude = Latitude.Value;
        if (Longitude.HasValue)
            train.TrainData.Longitude = Longitude.Value;
        train.TrainData.Velocity = Velocity;
    }
}