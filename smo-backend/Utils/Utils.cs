using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using Newtonsoft.Json;
using Prometheus;
using SMOBackend.Data;
using SMOBackend.Models;

namespace SMOBackend.Utils;

internal static class Utils
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

    internal static async Task LogStat(this IServiceScopeFactory scopeFactory,
        string serviceId, int duration, int count, int? serverCount = null, CancellationToken? stoppingToken = null)
    {
        using var scope = scopeFactory.CreateScope();
        await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

        context.Stats.Add(new(serviceId, duration, count, serverCount));

        if (stoppingToken.HasValue)
            await context.SaveChangesAsync(stoppingToken.Value);
        else
            await context.SaveChangesAsync();
    }

    internal static void Clear(this Gauge gauge)
    {
        foreach (var labelValues in gauge.GetAllLabelValues()) gauge.RemoveLabelled(labelValues);
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
}