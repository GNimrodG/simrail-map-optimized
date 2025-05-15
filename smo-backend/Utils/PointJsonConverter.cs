using NetTopologySuite.Geometries;
using Newtonsoft.Json;

namespace SMOBackend.Utils;

/// <summary>
/// Custom JSON converter for the <see cref="Point"/> type.
/// </summary>
public class PointJsonConverter : JsonConverter<Point>
{
    /// <inheritdoc />
    public override void WriteJson(JsonWriter writer, Point? value, JsonSerializer serializer)
    {
        if (value == null)
        {
            writer.WriteNull();
            return;
        }

        writer.WriteStartObject();
        writer.WritePropertyName("X");
        writer.WriteValue(value.X);
        writer.WritePropertyName("Y");
        writer.WriteValue(value.Y);
        writer.WriteEndObject();
    }

    /// <inheritdoc />
    public override Point? ReadJson(JsonReader reader, Type objectType, Point? existingValue, bool hasExistingValue,
        JsonSerializer serializer)
    {
        if (reader.TokenType == JsonToken.Null)
        {
            return null;
        }

        if (reader.TokenType != JsonToken.StartObject)
        {
            throw new JsonSerializationException("Expected StartObject token.");
        }

        double x = 0;
        double y = 0;

        while (reader.Read())
        {
            if (reader.TokenType == JsonToken.EndObject)
            {
                break;
            }

            var propertyName = reader.Value?.ToString();
            reader.Read();

            switch (propertyName)
            {
                case "X":
                    x = Convert.ToDouble(reader.Value);
                    break;
                case "Y":
                    y = Convert.ToDouble(reader.Value);
                    break;
                default:
                    throw new JsonSerializationException($"Unexpected property name: {propertyName}");
            }
        }

        return new(x, y) { SRID = 4326 };
    }
}