namespace SMOBackend.Models.Steam;

/// <summary>
///     Represents a summary of a Steam player's profile.
/// </summary>
public class PlayerStatsResponse
{
    /// <summary>
    ///     Represents the data contained in the response, which includes player statistics for a specific game.
    /// </summary>
    public PlayerStats PlayerStats { get; set; } = null!;
}