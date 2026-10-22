using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using SMOBackend.Analytics;
using SMOBackend.Data;
using SMOBackend.Models;
using SMOBackend.Models.Entity;
using SMOBackend.Utils;

namespace SMOBackend.Controllers;

/// <summary>
/// Controller for managing signals.
/// </summary>
[ApiController]
[Route("signals")]
[Produces("application/json")]
public class SignalsController(SmoContext context, SignalAnalyzerService signalAnalyzerService) : Controller
{
    private static bool ValidatePassword(string? password) =>
        !string.IsNullOrWhiteSpace(StdUtils.GetEnvVar("ADMIN_PASSWORD", "")) &&
        StdUtils.GetEnvVar("ADMIN_PASSWORD", "") == password;

    /// <summary>
    /// Get all signals.
    /// </summary>
    /// <param name="password">The password for authentication.</param>
    /// <returns>The list of signals.</returns>
    [HttpGet]
    public async Task<ActionResult> GetSignals([FromHeader] string password)
    {
        if (!ValidatePassword(password))
            return Unauthorized("Invalid password.");

        var signals = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .ToListAsync();

        return Ok(signals.Select(s => new SignalStatus(s)).ToArray());
    }

    /// <summary>
    /// Set the signal's next finalized state to true.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The updated signal.</returns>
    [HttpPost("{signalName}/next/finalize")]
    public async Task<ActionResult> FinalizeNextSignals(string signalName, [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        if (signal.NextSignalConnections.Count == 0)
            return BadRequest($"Signal {signalName} has no next signals to finalize.");

        signal.NextFinalized = true;
        signal.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-edit signals for a while and the edit seems to revert
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new SignalStatus(signal));
    }

    /// <summary>
    /// Set the signal's next finalized state to false.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The updated signal.</returns>
    [HttpPost("{signalName}/next/reset")]
    public async Task<ActionResult> ResetNextFinalized(string signalName, [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        signal.NextFinalized = false;
        signal.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-edit signals for a while and the edit seems to revert
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new SignalStatus(signal));
    }

    /// <summary>
    /// Delete the next signal.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="nextSignalName">The name of the next signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The updated signal.</returns>
    [HttpDelete("{signalName}/next/{nextSignalName}")]
    public async Task<ActionResult> DeleteNextSignal(string signalName, string nextSignalName,
        [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        var nextSignal = signal.NextSignalConnections
            .FirstOrDefault(ns => ns.Next == nextSignalName);

        if (nextSignal == null)
            return NotFound($"Next signal {nextSignalName} not found in signal {signalName}.");

        context.SignalConnections.Remove(nextSignal);

        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-edit signals for a while and the edit seems to revert
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new SignalStatus(signal));
    }

    /// <summary>
    /// Set the signal's prev finalized state to true.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The updated signal.</returns>
    [HttpPost("{signalName}/prev/finalize")]
    public async Task<ActionResult> FinalizePrevSignals(string signalName, [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        if (signal.PrevSignalConnections.Count == 0)
            return BadRequest($"Signal {signalName} has no previous signals to finalize.");

        signal.PrevFinalized = true;
        signal.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-edit signals for a while and the edit seems to revert
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new SignalStatus(signal));
    }

    /// <summary>
    /// Set the signal's prev finalized state to false.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The updated signal.</returns>
    [HttpPost("{signalName}/prev/reset")]
    public async Task<ActionResult> ResetPrevFinalized(string signalName, [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        signal.PrevFinalized = false;
        signal.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-edit signals for a while and the edit seems to revert
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new SignalStatus(signal));
    }

    /// <summary>
    /// Delete the previous signal.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="prevSignalName">The name of the previous signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The updated signal.</returns>
    [HttpDelete("{signalName}/prev/{prevSignalName}")]
    public async Task<ActionResult> DeletePrevSignal(string signalName, string prevSignalName,
        [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        var prevSignal = signal.PrevSignalConnections
            .FirstOrDefault(ps => ps.Prev == prevSignalName);

        if (prevSignal == null)
            return NotFound($"Prev signal {prevSignalName} not found in signal {signalName}.");

        context.SignalConnections.Remove(prevSignal);

        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-edit signals for a while and the edit seems to revert
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new SignalStatus(signal));
    }

    /// <summary>
    /// Create or correct signals from the game files: new signals are added, existing ones get the exact location
    /// (accuracy 0, so trains don't overwrite it), the heading and the extra data. Connections are not touched.
    /// </summary>
    /// <remarks>
    /// A signal the game has more than once comes with every copy, the one nearest the known location is used.
    /// Trains are the ground truth for the signals they passed: when a signal learned from trains (accuracy under
    /// <see cref="ImportConflictAccuracy"/> m) is more than <see cref="ImportConflictDistance"/> m from the game's
    /// position, its location and heading are kept (the game's object isn't the signal there, the heading may have
    /// been set from the tracks) and the signal is returned as a conflict, unless it's in
    /// <see cref="SignalImportRequest.Overrule"/>.
    /// </remarks>
    /// <param name="body">The signals and the password.</param>
    /// <returns>How many signals were added and updated, and the conflicts.</returns>
    [HttpPost("import")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult> ImportSignals([FromBody] SignalImportRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var invalid = body.Signals
            .Where(s => string.IsNullOrWhiteSpace(s.Name) || s.Name.Length > StdUtils.SignalNameLength ||
                        s.Extra.Length > 255 || s.Heading is < 0 or >= 360 ||
                        s.Longitude is < -180 or > 180 || s.Latitude is < -90 or > 90)
            .Select(s => s.Name)
            .ToArray();
        if (invalid.Length > 0)
            return BadRequest($"Invalid signals: {string.Join(", ", invalid.Take(20))}");

        var copiesByName = body.Signals.GroupBy(s => s.Name).ToDictionary(g => g.Key, g => g.ToList());
        var names = copiesByName.Keys.ToArray();
        var existing = await context.Signals
            .Where(s => names.Contains(s.Name))
            .ToDictionaryAsync(s => s.Name);
        var overrule = body.Overrule.ToHashSet();

        var now = DateTime.UtcNow;
        int added = 0, updated = 0;
        var conflicts = new List<object>();
        foreach (var (name, copies) in copiesByName)
        {
            existing.TryGetValue(name, out var signal);
            var entry = SignalImportEntry.PickCopy(copies, signal?.Location);
            var location = new Point(entry.Longitude, entry.Latitude) { SRID = 4326 };
            if (signal != null)
            {
                var distance = signal.Location.HaversineDistance(location);
                if (signal.Accuracy is > 0 and < ImportConflictAccuracy && distance > ImportConflictDistance &&
                    !overrule.Contains(name))
                {
                    conflicts.Add(new { signal.Name, Distance = Math.Round(distance), signal.Accuracy });
                }
                else
                {
                    signal.Location = location;
                    signal.Accuracy = 0;
                    signal.Extra = entry.Extra;
                    signal.Heading = entry.Heading ?? signal.Heading;
                }

                signal.UpdatedAt = now;
                updated++;
                continue;
            }

            signal = new Signal
            {
                Name = entry.Name,
                Extra = entry.Extra,
                Location = location,
                Accuracy = 0,
                Heading = entry.Heading,
                PrevFinalized = false,
                NextFinalized = false,
                NextSignalConnections = [],
                PrevSignalConnections = [],
                CreatedBy = "game-files"
            };
            signal.UpdateType(null);
            context.Signals.Add(signal);
            added++;
        }

        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-import signals for a while
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new { added, updated, conflicts });
    }

    private const double ImportConflictAccuracy = 5;
    private const double ImportConflictDistance = 50;

    /// <summary>
    /// Delete a signal.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The deleted signal.</returns>
    [HttpDelete("{signalName}")]
    public async Task<ActionResult> DeleteSignal(string signalName, [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        context.Signals.Remove(signal);
        await context.SaveChangesAsync();
        // otherwise clients get the cached pre-edit signals for a while and the edit seems to revert
        signalAnalyzerService.InvalidateSignalsSnapshot();

        return Ok(new SignalStatus(signal));
    }
}