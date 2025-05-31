namespace SMOBackend.Models.Steam;

/// <summary>
///     Represents a key-value pair for a player's statistic in a game.
/// </summary>
public class PlayerStat
{
    /// <summary>
    ///     The name of the statistic, such as "SCORE" or "DISPATCHER_TIME".
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    ///     The value of the statistic, which is an integer.
    /// </summary>
    public int Value { get; set; }
}