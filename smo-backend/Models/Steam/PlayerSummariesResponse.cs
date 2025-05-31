using Newtonsoft.Json;

namespace SMOBackend.Models.Steam;

/// <summary>
///     Represent a response from the Steam API containing player summaries.
/// </summary>
public class PlayerSummariesResponse
{
    /// <summary>
    ///     The response data containing player summaries.
    /// </summary>
    [JsonProperty("response")]
    public ResponseData Response { get; set; } = null!;

    /// <summary>
    ///     Represents the data contained in the response, which includes an array of player summaries.
    /// </summary>
    public class ResponseData
    {
        /// <summary>
        ///     An array of player summaries, each representing a Steam user's profile information.
        /// </summary>
        [JsonProperty("players")]
        public PlayerSummary[] Players { get; set; } = null!;
    }
}