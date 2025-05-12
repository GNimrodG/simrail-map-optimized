namespace SMOBackend.Models;

/// <summary>
/// Represents a 404 Not Found error.
/// </summary>
public class NotFoundError(string message, string code)
{
    /// <summary>
    /// The error message.
    /// </summary>
    public string Message { get; set; } = message;
    /// <summary>
    /// The error code.
    /// </summary>
    public string Code { get; set; } = code;    
}