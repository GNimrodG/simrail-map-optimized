using System.Diagnostics.CodeAnalysis;

namespace SMOBackend.Services;

/// <summary>
///     Extension methods for registering hosted services.
/// </summary>
public static class HostedServiceExtensions
{
    /// <summary>
    ///     Adds a hosted service that is also a singleton, so the running instance can be injected into other services,
    ///     controllers and hubs. Hosted services start in the order they're added and stop in reverse order.
    /// </summary>
    public static IServiceCollection AddSingletonHostedService<
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
        T>(this IServiceCollection services)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService(provider => provider.GetRequiredService<T>());
        return services;
    }
}
