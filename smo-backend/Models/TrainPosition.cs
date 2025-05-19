using Newtonsoft.Json;
using SMOBackend.Models.Entity;
using SMOBackend.Models.Trains;

namespace SMOBackend.Models;

public class TrainPosition : IEntityWithTimestamp
{
    /// <summary>
    /// The id of the train.
    /// </summary>
    [JsonProperty("id")]
    public required string Id { get; set; }

    /// <summary>
    /// The latitude of the train.
    /// </summary>
    [JsonProperty(nameof(Latitude))]
    public double? Latitude { get; set; }

    /// <summary>
    /// The longitude of the train.
    /// </summary>
    [JsonProperty(nameof(Longitude))]
    public double? Longitude { get; set; }

    /// <summary>
    /// The velocity of the train.
    /// </summary>
    [JsonProperty(nameof(Velocity))]
    public required double Velocity { get; set; }

    /// <inheritdoc />
    [JsonIgnore]
    public DateTime Timestamp { get; set; }

    /// <summary>
    /// Applies the position to the train if the train's timestamp is less than or equal to this position's timestamp.
    /// </summary>
    public void ApplyTo(Train train)
    {
        if (train.Timestamp > Timestamp || train.Id != Id || !Latitude.HasValue || !Longitude.HasValue)
            return;

        train.TrainData.OriginalLocation = train.TrainData.Location;
        train.TrainData.Latitude = Latitude.Value;
        train.TrainData.Longitude = Longitude.Value;
        train.TrainData.Velocity = Velocity;
    }
}