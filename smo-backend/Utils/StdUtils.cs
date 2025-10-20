using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Reflection;
using System.Runtime.CompilerServices;
using Newtonsoft.Json;
using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models;

namespace SMOBackend.Utils;

internal static class StdUtils
{
    public const int SignalNameLength = 15;

    internal static IServiceCollection AddHostedServiceSingleton<
        [DynamicallyAccessedMembers(DynamicallyAccessedMemberTypes.PublicConstructors)]
        TService>(
        this IServiceCollection services)
        where TService : class, IHostedService
    {
        services.AddSingleton<TService>();
        services.AddHostedService(provider => provider.GetRequiredService<TService>());

        return services;
    }

    public static Type GetUnderlyingType(this MemberInfo member)
    {
        return member.MemberType switch
        {
            MemberTypes.Field => ((FieldInfo)member).FieldType,
            MemberTypes.Method => ((MethodInfo)member).ReturnType,
            MemberTypes.Property => ((PropertyInfo)member).PropertyType,
            _ => throw new ArgumentException(
                "Input MemberInfo must be if type FieldInfo, MethodInfo, or PropertyInfo")
        };
    }

    internal static Task LogStat(this IServiceScopeFactory scopeFactory,
        string serviceId, int duration, CancellationToken? stoppingToken = null)
    {
        StatsBuffer.Enqueue(scopeFactory, serviceId, duration, stoppingToken);
        return Task.CompletedTask;
    }

    internal static void Clear(this Gauge gauge)
    {
        foreach (var labelValues in gauge.GetAllLabelValues()) gauge.RemoveLabelled(labelValues);
    }

    internal static void RemoveLabelledByPredicate(this Gauge gauge, Func<string[], bool> predicate)
    {
        foreach (var labelValues in gauge.GetAllLabelValues().Where(predicate)) gauge.RemoveLabelled(labelValues);
    }

    /// <summary>
    ///     Reads an environment variable and returns the value as the specified type, with a default fallback.
    /// </summary>
    /// <typeparam name="T">The type to convert the environment variable value to</typeparam>
    /// <param name="name">The name of the environment variable</param>
    /// <param name="defaultValue">The default value to return if the environment variable is not set</param>
    /// <returns>The value of the environment variable as the specified type</returns>
    public static T GetEnvVar<T>(string name, T defaultValue)
    {
        var value = Environment.GetEnvironmentVariable(name);

        if (string.IsNullOrEmpty(value)) return defaultValue;

        try
        {
            return (T)Convert.ChangeType(value, typeof(T), CultureInfo.InvariantCulture);
        }
        catch
        {
            return defaultValue;
        }
    }

    /// <summary>
    ///     Reads a duration environment variable. Accepts either TimeSpan format (e.g., 00:00:05) or integer seconds (e.g.,
    ///     5).
    /// </summary>
    public static TimeSpan GetEnvVarDuration(string name, TimeSpan defaultValue)
    {
        var raw = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrWhiteSpace(raw)) return defaultValue;

        if (TimeSpan.TryParse(raw, CultureInfo.InvariantCulture, out var ts))
            return ts;

        if (int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var seconds) && seconds >= 0)
            return TimeSpan.FromSeconds(seconds);

        if (double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var dblSeconds) &&
            dblSeconds >= 0)
            return TimeSpan.FromSeconds(dblSeconds);

        return defaultValue;
    }

    public class TrainTypeCodeConverter : JsonConverter<SimplifiedTimetableEntry.TrainTypeCode>
    {
        public override void WriteJson(JsonWriter writer, SimplifiedTimetableEntry.TrainTypeCode value,
            JsonSerializer serializer)
        {
            writer.WriteValue(value.ToString());
        }

        public override SimplifiedTimetableEntry.TrainTypeCode ReadJson(JsonReader reader, Type objectType,
            SimplifiedTimetableEntry.TrainTypeCode existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.String)
            {
                var code = (string)reader.Value!;
                return new(code);
            }

            throw new JsonSerializationException($"Unexpected token {reader.TokenType} when parsing TrainTypeCode.");
        }
    }

    public static ConfiguredTaskAwaitable NoContext(this Task task) => task.ConfigureAwait(false);
    
    public static ConfiguredTaskAwaitable<T> NoContext<T>(this Task<T> task) => task.ConfigureAwait(false);
    
    public static ConfiguredValueTaskAwaitable<T> NoContext<T>(this ValueTask<T> task) => task.ConfigureAwait(false);
}