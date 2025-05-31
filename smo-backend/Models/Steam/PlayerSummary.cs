namespace SMOBackend.Models.Steam;

/// <summary>
///     Represents a summary of a Steam player's profile.
/// </summary>
public class PlayerSummary
{
    /// <summary>
    ///     64bit SteamID of the user
    /// </summary>
    public string SteamId { get; set; } = null!;

    /// <summary>
    ///     This represents whether the profile is visible or not, and if it is visible, why you are allowed to see it. Note
    ///     that because this WebAPI does not use authentication, there are only two possible values returned: 1 - the profile
    ///     is not visible to you (Private, Friends Only, etc), 3 - the profile is "Public", and the data is visible. Mike
    ///     Blaszczak's post on Steam forums says, "The community visibility state this API returns is different than the
    ///     privacy state. It's the effective visibility state from the account making the request to the account being viewed
    ///     given the requesting account's relationship to the viewed account."
    /// </summary>
    public int CommunityVisibilityState { get; set; }

    /// <summary>
    ///     If set, indicates the user has a community profile configured (will be set to '1')
    /// </summary>
    public int ProfileState { get; set; }

    /// <summary>
    ///     The player's persona name (display name)
    /// </summary>
    public string PersonaName { get; set; } = null!;

    /// <summary>
    ///     If set, indicates the profile allows public comments.
    /// </summary>
    public int? CommentPermission { get; set; }

    /// <summary>
    ///     The full URL of the player's Steam Community profile.
    /// </summary>
    public string ProfileUrl { get; set; } = null!;

    /// <summary>
    ///     The full URL of the player's 32x32px avatar. If the user hasn't configured an avatar, this will be the default ?
    ///     avatar.
    /// </summary>
    public string Avatar { get; set; } = null!;

    /// <summary>
    ///     The full URL of the player's 64x64px avatar. If the user hasn't configured an avatar, this will be the default ?
    ///     avatar.
    /// </summary>
    public string AvatarMedium { get; set; } = null!;

    /// <summary>
    ///     The full URL of the player's 184x184px avatar. If the user hasn't configured an avatar, this will be the default ?
    ///     avatar.
    /// </summary>
    public string AvatarFull { get; set; } = null!;

    /// <summary>
    ///     The hash of the user's avatar, used to determine if the avatar has changed. This is a 32-character hexadecimal
    ///     string.
    /// </summary>
    public string AvatarHash { get; set; } = null!;

    /// <summary>
    ///     The last time the user was online, in unix time.
    /// </summary>
    public long? LastLogoff { get; set; }

    /// <summary>
    ///     The user's current status. 0 - Offline, 1 - Online, 2 - Busy, 3 - Away, 4 - Snooze, 5 - looking to trade, 6 -
    ///     looking to play. If the player's profile is private, this will always be "0", except is the user has set their
    ///     status to looking to trade or looking to play, because a bug makes those status appear even if the profile is
    ///     private.
    /// </summary>
    public int PersonaState { get; set; }

    /// <summary>
    ///     The player's "Real Name", if they have set it.
    /// </summary>
    public string? RealName { get; set; }

    /// <summary>
    ///     The player's primary group, as configured in their Steam Community profile.
    /// </summary>
    public string PrimaryClanId { get; set; } = null!;

    /// <summary>
    ///     The time the player's account was created.
    /// </summary>
    public long TimeCreated { get; set; }

    /// <summary>
    ///     Unknown, but seems to be related to the user's profile settings. It is a bitmask of flags. Most of the time it is
    ///     0.
    /// </summary>
    public int PersonaStateFlags { get; set; }

    /// <summary>
    ///     If set on the user's Steam Community profile, The user's country of residence, 2-character ISO country code
    /// </summary>
    public string? LocCountryCode { get; set; }

    /// <summary>
    ///     If set on the user's Steam Community profile, The user's state of residence
    /// </summary>
    public string? LocStateCode { get; set; }

    /// <summary>
    ///     An internal code indicating the user's city of residence. A future update will provide this data in a more useful
    ///     way.
    /// </summary>
    public int? LocCityId { get; set; }
}