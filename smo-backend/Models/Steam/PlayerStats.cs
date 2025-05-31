using Newtonsoft.Json;

namespace SMOBackend.Models.Steam;

/// <summary>
///     Stats for a player in a specific game.
/// </summary>
public class PlayerStats
{
    /// <summary>
    ///     The Steam ID of the player.
    /// </summary>
    [JsonProperty("steamId")]
    public string SteamId { get; set; } = null!;

    /// <summary>
    ///     The name of the game for which the stats are being reported.
    /// </summary>
    public string GameName { get; set; } = null!;

    /// <summary>
    ///     The achievements the player has unlocked in the game.
    /// </summary>
    public List<PlayerAchievement> Achievements { get; set; } = null!;

    /// <summary>
    ///     Key-value pairs representing various statistics for the player in the game.
    /// </summary>
    public List<PlayerStat> Stats { get; set; } = null!;
}