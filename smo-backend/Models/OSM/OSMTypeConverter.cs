using System.Text.Json;
using System.Text.Json.Serialization;

namespace SMOBackend.Models.OSM;

/// <summary>
///     Converter for OSMType that can handle both OSMNode and OSMWay.
/// </summary>
/// This converter reads the "type" property to determine which specific type to deserialize into.
/// It supports both "node" and "way" types, throwing an exception for any other type.
/// It also handles the serialization of OSMType back to JSON, preserving the specific type information
public class OsmTypeConverter : JsonConverter<OSMType>
{
    /// <inheritdoc cref="JsonConverter{OSMType}.Read" />
    public override OSMType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        if (!root.TryGetProperty("type", out var typeElement))
            throw new JsonException("OSM element missing 'type' property");

        var type = typeElement.GetString();

        OSMType osmElement = type switch
        {
            "node" => JsonSerializer.Deserialize<OSMNode>(root.GetRawText(), options)!,
            "way" => JsonSerializer.Deserialize<OSMWay>(root.GetRawText(), options)!,
            _ => throw new JsonException($"Unknown OSM type: {type}")
        };

        if (osmElement == null) throw new JsonException($"Failed to deserialize OSM element of type: {type}");

        return osmElement;
    }

    /// <inheritdoc cref="JsonConverter{OSMType}.Write" />
    public override void Write(Utf8JsonWriter writer, OSMType value, JsonSerializerOptions options)
    {
        JsonSerializer.Serialize(writer, value, value.GetType(), options);
    }
}