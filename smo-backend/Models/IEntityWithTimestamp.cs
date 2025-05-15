namespace SMOBackend.Models.Entity;

/// <summary>
/// Represents an entity with a timestamp.
/// </summary>
public interface IEntityWithTimestamp
{
    /// <summary>
    /// Gets or sets the timestamp of the entity.
    /// </summary>
    DateTime Timestamp { get; set; }
}

