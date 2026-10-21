using FluentAssertions;
using NetTopologySuite.Geometries;
using SMOBackend.Models;

namespace SMOBackend.Tests.Models;

/// <summary>
///     Unit tests for <see cref="SignalImportEntry.PickCopy" />.
/// </summary>
public class SignalImportEntryTests
{
    private static SignalImportEntry Copy(string extra, double latitude, double longitude) =>
        new() { Name = "Tl_A", Extra = extra, Latitude = latitude, Longitude = longitude };

    // Tl_A is in the game twice, about 260 m apart; the trains report the second copy
    private static readonly SignalImportEntry First = Copy("58476,421886,9", 50.4354, 19.9930);
    private static readonly SignalImportEntry Second = Copy("58643,722084,8", 50.43760, 19.99511);

    [Fact]
    public void PickCopy_NewSignal_TakesTheFirstCopy()
    {
        SignalImportEntry.PickCopy([First, Second], null).Should().BeSameAs(First);
    }

    [Fact]
    public void PickCopy_KnownSignal_TakesTheCopyNearestItsLocation()
    {
        var learned = new Point(19.99511, 50.43759) { SRID = 4326 };

        SignalImportEntry.PickCopy([First, Second], learned).Should().BeSameAs(Second);
    }

    [Fact]
    public void PickCopy_SingleCopy_IsTakenWherever()
    {
        var farAway = new Point(21.0, 52.2) { SRID = 4326 };

        SignalImportEntry.PickCopy([First], farAway).Should().BeSameAs(First);
    }
}
