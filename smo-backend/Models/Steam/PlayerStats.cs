namespace SMOBackend.Models.Steam;

public class PlayerStats
{
    public string SteamID { get; set; } = null!;
    public string GameName { get; set; } = null!;
    public List<PlayerAchievement> Achievements { get; set; } = null!;
    public List<PlayerStat> Stats { get; set; } = null!;
}