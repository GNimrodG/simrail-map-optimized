using MessagePack;

namespace SMOBackend.Models;

[MessagePackObject(keyAsPropertyName: true)]
public class TimeData
{
    public TimeData()
    {
    }

    public TimeData(long time, int timezone, DateTime date)
    {
        Time = time;
        Timezone = timezone;
        LastUpdated = date;
    }

    /// <summary>
    /// The current time on the server in milliseconds since the Unix epoch.
    /// </summary>
    public long Time { get; set; }

    /// <summary>
    /// The timezone offset of the server in hours.
    /// </summary>
    public int Timezone { get; set; }

    /// <summary>
    /// The date and time when the data was last updated.
    /// </summary>
    public DateTime LastUpdated { get; set; }
}