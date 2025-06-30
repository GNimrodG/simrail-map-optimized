using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

// ReSharper disable SwitchStatementHandlesSomeKnownEnumValuesWithDefault

namespace SMOBackend.Utils;

/// <summary>
/// Custom JSON converter that uses string.Intern to reduce memory usage for frequently repeated strings
/// </summary>
public class InterningStringConverter : JsonConverter<string?>
{
    /// <inheritdoc />
    public override void WriteJson(JsonWriter writer, string? value, JsonSerializer serializer) =>
        writer.WriteValue(value);

    /// <summary>
    /// Reads JSON value and interns the string
    /// </summary>
    public override string? ReadJson(JsonReader reader, Type objectType, string? existingValue, bool hasExistingValue,
        JsonSerializer serializer)
    {
        switch (reader.TokenType)
        {
            case JsonToken.Null:
                return null;
            case JsonToken.String:
            {
                var value = reader.Value?.ToString();
                return value == null ? null : string.Intern(value);
            }
            default:
                throw new JsonSerializationException($"Unexpected token type: {reader.TokenType}");
        }
    }
}

/// <summary>
/// Custom enum converter that interns the string representation of enums
/// </summary>
public class InterningStringEnumConverter : StringEnumConverter
{
    /// <summary>
    /// Reads JSON value and interns enum strings
    /// </summary>
    public override object? ReadJson(JsonReader reader, Type objectType, object? existingValue,
        JsonSerializer serializer)
    {
        switch (reader.TokenType)
        {
            case JsonToken.String:
            {
                var enumString = reader.Value?.ToString();
                if (enumString == null) return base.ReadJson(reader, objectType, existingValue, serializer);

                // Intern the enum string before parsing
                enumString = string.Intern(enumString);

                // Handle nullable enums
                var enumType = Nullable.GetUnderlyingType(objectType) ?? objectType;

                if (Enum.TryParse(enumType, enumString, true, out var result))
                {
                    return result;
                }

                throw new JsonSerializationException($"Unable to parse '{enumString}' to enum {enumType.Name}");
            }
            case JsonToken.Null when Nullable.GetUnderlyingType(objectType) != null:
                return null;
            default:
                return base.ReadJson(reader, objectType, existingValue, serializer);
        }
    }
}