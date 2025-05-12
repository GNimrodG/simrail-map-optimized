using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMOBackend.Data;
using SMOBackend.Models;

namespace SMOBackend.Controllers;

/// <summary>
/// Controller for managing signals.
/// </summary>
[ApiController]
[Route("signals")]
[Produces("application/json")]
public class SignalsController(SmoContext context) : Controller
{
    private static bool ValidatePassword(string? password) =>
        !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("ADMIN_PASSWORD")) &&
        Environment.GetEnvironmentVariable("ADMIN_PASSWORD") == password;

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
    public async Task<ActionResult> GetNextFinalized(string signalName, [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        signal.NextFinalized = true;
        signal.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

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

        return Ok(new SignalStatus(signal));
    }

    /// <summary>
    /// Set the signal's prev finalized state to true.
    /// </summary>
    /// <param name="signalName">The name of the signal.</param>
    /// <param name="body">The request body containing the password.</param>
    /// <returns>The updated signal.</returns>
    [HttpPost("{signalName}/prev/finalize")]
    public async Task<ActionResult> GetPrevFinalized(string signalName, [FromBody] PasswordRequest body)
    {
        if (!ValidatePassword(body.Password))
            return Unauthorized("Invalid password.");

        var signal = await context.Signals
            .Include(s => s.PrevSignalConnections)
            .Include(s => s.NextSignalConnections)
            .FirstOrDefaultAsync(s => s.Name == signalName);

        if (signal == null)
            return NotFound($"Signal {signalName} not found.");

        signal.PrevFinalized = true;
        signal.UpdatedAt = DateTime.UtcNow;

        await context.SaveChangesAsync();

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

        return Ok(new SignalStatus(signal));
    }

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

        return Ok(new SignalStatus(signal));
    }
}