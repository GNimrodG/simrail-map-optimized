using System.Reflection;

namespace SMOBackend.Utils;

/// <summary>
///     The backend's version: the build time (UTC) as YYYY.MM.DD.HHMM, like the frontend's, set by the SmoVersion
///     property in smo-backend.csproj; "dev" for Debug builds.
/// </summary>
public static class AppVersion
{
    /// <summary>The version of this build.</summary>
    public static string Current { get; } =
        typeof(AppVersion).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? "dev";

    /// <summary>The Sentry release name of this build.</summary>
    public static string SentryRelease => $"smo-backend@{Current}";
}
