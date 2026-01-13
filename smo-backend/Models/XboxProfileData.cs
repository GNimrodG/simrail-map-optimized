namespace SMOBackend.Models;

/// <summary>
///     Represents Xbox profile data.
/// </summary>
public class XboxProfileData
{
    /// <summary>
    ///   The gamertag of the Xbox user. (gamertag)
    /// </summary>
    public string PersonaName { get; set; }

    /// <summary>
    ///     The raw URL of the game display picture. (GameDisplayPicRaw)
    /// </summary>
    public string? Avatar { get; set; }
}