namespace SMOBackend.Utils;

/// <summary>
///     The timetables' abbreviated station names ("Dąbr. Górn.", "Tow.", ...) written out, as OpenStreetMap names them.
/// </summary>
public static class StationNames
{
    /// <summary>
    ///     The name with the timetables' abbreviations written out (the same name when it has none).
    /// </summary>
    public static string ExpandAbbreviations(string name) =>
        name
            .Replace("Much.", "Muchowiec ")
            .Replace("M.", "Muchowiec ")
            .Replace("M ", "Muchowiec ")
            .Replace("P.", "Południowa ")
            .Replace("P ", "Południowa ")
            .Replace("Tow ", "Towarowa ")
            .Replace("Tow.", "Towarowa ")
            .Replace("Gł.", "Główny ")
            .Replace("Dąbr.", "Dąbrowa ")
            .Replace("Górn.", "Górnicza ")
            .Replace("Maz.", "Mazowiecki ")
            .Replace("Zach.", "Zachodnia ")
            .Replace("Wsch.", "Wschodnia ")
            .Replace("Kr.", "Kraków ")
            .Replace("Żakow.", "Żakowice ")
            .Replace("Zakow.", "Zakowice ")
            .Replace("Kam.", "Kamienna ")
            .Replace("Roz.", "Rozdroże ")
            .Replace(".", "")
            .Replace("APO", "")
            .Replace("  ", " ") // Normalize spaces
            .Trim();
}
