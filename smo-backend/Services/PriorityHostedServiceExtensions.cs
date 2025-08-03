using System.Diagnostics.CodeAnalysis;

namespace SMOBackend.Services;

/// <summary>
///     Extension methods for registering hosted services with priority levels.
/// </summary>
public static class PriorityHostedServiceExtensions
{
    /// <summary>
    ///     Adds a hosted service with high priority (for data services).
    /// </summary>
    public static IServiceCollection AddHighPriorityHostedService<
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
        T>(this IServiceCollection services)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService<PriorityHostedService<T>>(provider =>
            new(
                provider.GetRequiredService<T>(),
                ServicePriority.High,
                provider.GetRequiredService<ILogger<PriorityHostedService<T>>>()
            ));
        return services;
    }

    /// <summary>
    ///     Adds a hosted service with low priority (for analytics services).
    /// </summary>
    public static IServiceCollection AddLowPriorityHostedService<
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
        T>(this IServiceCollection services)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService<PriorityHostedService<T>>(provider =>
            new(
                provider.GetRequiredService<T>(),
                ServicePriority.Low,
                provider.GetRequiredService<ILogger<PriorityHostedService<T>>>()
            ));
        return services;
    }

    /// <summary>
    ///     Adds a hosted service with normal priority.
    /// </summary>
    public static IServiceCollection AddNormalPriorityHostedService<
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
        T>(this IServiceCollection services)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService<PriorityHostedService<T>>(provider =>
            new(
                provider.GetRequiredService<T>(),
                ServicePriority.Normal,
                provider.GetRequiredService<ILogger<PriorityHostedService<T>>>()
            ));
        return services;
    }

    /// <summary>
    ///     Adds a hosted service with critical priority.
    /// </summary>
    public static IServiceCollection AddCriticalPriorityHostedService<
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
        T>(this IServiceCollection services)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService<PriorityHostedService<T>>(provider =>
            new(
                provider.GetRequiredService<T>(),
                ServicePriority.Critical,
                provider.GetRequiredService<ILogger<PriorityHostedService<T>>>()
            ));
        return services;
    }

    /// <summary>
    ///     Adds a hosted service with the specified priority.
    /// </summary>
    public static IServiceCollection AddPriorityHostedService<
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
        T>(this IServiceCollection services, ServicePriority priority)
        where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService<PriorityHostedService<T>>(provider =>
            new(
                provider.GetRequiredService<T>(),
                priority,
                provider.GetRequiredService<ILogger<PriorityHostedService<T>>>()
            ));
        return services;
    }
}