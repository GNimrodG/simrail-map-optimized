using Newtonsoft.Json;

namespace SMOBackend.Models.Steam;

/// <summary>
///     The Steam API's answer to ISteamUser/ResolveVanityURL.
/// </summary>
public class ResolveVanityUrlResponse
{
    /// <summary>
    ///     The response data.
    /// </summary>
    [JsonProperty("response")]
    public ResponseData Response { get; set; } = null!;

    /// <summary>
    ///     The resolved Steam ID and the result code.
    /// </summary>
    public class ResponseData
    {
        /// <summary>
        ///     1 when the name was found, 42 when no profile has it.
        /// </summary>
        [JsonProperty("success")]
        public int Success { get; set; }

        /// <summary>
        ///     The 64-bit Steam ID (only on success).
        /// </summary>
        [JsonProperty("steamid")]
        public string? SteamId { get; set; }
    }
}
