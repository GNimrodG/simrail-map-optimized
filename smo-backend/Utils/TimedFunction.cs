namespace SMOBackend.Utils;

/// <summary>
/// A utility class that runs a specified action at regular intervals on a separate thread.
/// </summary>
public class TimedFunction : IDisposable
{
    private Thread _thread;

    /// <summary>
    /// Initializes a new instance of the <see cref="TimedFunction"/> class that runs the specified action at regular intervals.
    /// </summary>
    public TimedFunction(Action action, TimeSpan interval, CancellationToken cancellationToken = default)
    {
        _thread = new(async void () =>
        {
            try
            {
                using var timer = new PeriodicTimer(interval);
                while (!cancellationToken.IsCancellationRequested)
                {
                    await timer.WaitForNextTickAsync(cancellationToken);
                    action();
                }
            }
            catch (Exception e)
            {
                // Log the exception or handle it as needed
                Console.Error.WriteLine($"Error in TimedFunction: {e.Message}");
            }
        });

        _thread.Start();
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="TimedFunction"/> class that runs the specified action at regular intervals and executes an exit action when the timer stops.
    /// </summary>
    public TimedFunction(Action action, Action exitAction, TimeSpan interval, CancellationToken cancellationToken)
    {
        _thread = new(async void () =>
        {
            try
            {
                using var timer = new PeriodicTimer(interval);
                while (!cancellationToken.IsCancellationRequested)
                {
                    await timer.WaitForNextTickAsync(cancellationToken).NoContext();
                    action();
                }
            }
            catch (Exception e)
            {
                // Log the exception or handle it as needed
                Console.Error.WriteLine($"Error in TimedFunction: {e.Message}");
            }
            finally
            {
                exitAction();
            }
        });

        _thread.Start();
    }

    /// <inheritdoc />
    public void Dispose()
    {
        if (!_thread.IsAlive) return;
        _thread.Interrupt();
        _thread.Join();
        _thread = null!;
        GC.SuppressFinalize(this);
    }

    ~TimedFunction() => Dispose();
}