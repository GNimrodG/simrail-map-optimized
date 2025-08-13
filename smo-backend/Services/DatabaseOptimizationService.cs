using Microsoft.EntityFrameworkCore;
using Npgsql;
using SMOBackend.Data;

namespace SMOBackend.Services;

/// <summary>
///     Service to optimize database configuration at runtime for better performance under load
/// </summary>
public class DatabaseOptimizationService : IHostedService
{
    private readonly ILogger<DatabaseOptimizationService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    public DatabaseOptimizationService(
        IServiceScopeFactory scopeFactory,
        ILogger<DatabaseOptimizationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        // Allow disabling this service for managed Postgres providers
        if (!string.Equals(Environment.GetEnvironmentVariable("DB_TUNING_ENABLED"), "true",
                StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("Database optimization disabled (set DB_TUNING_ENABLED=true to enable)");
            return;
        }

        _logger.LogInformation("Applying database optimizations...");

        try
        {
            using var scope = _scopeFactory.CreateScope();
            await using var context = scope.ServiceProvider.GetRequiredService<SmoContext>();

            await ApplyPostgresOptimizations(context);
            await OptimizeAutovacuum(context);
            // WAL/system-level settings require superuser and may not be allowed on managed services.
            // Only attempt if DB_TUNING_WAL=true
            if (string.Equals(Environment.GetEnvironmentVariable("DB_TUNING_WAL"), "true",
                    StringComparison.OrdinalIgnoreCase))
                await ConfigureWALSettings(context);

            _logger.LogInformation("Database optimizations applied (where permitted)");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to apply database optimizations");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    private async Task ApplyPostgresOptimizations(SmoContext context)
    {
        // Only session-level, typically USERSET parameters to avoid errors on managed providers
        var optimizations = new[]
        {
            // Increase work memory for complex queries (session)
            "SET work_mem = '128MB'",
            // Prefer lower random page cost on SSDs (session)
            "SET random_page_cost = 1.1"
            // Note: maintenance_work_mem, checkpoint_completion_target, shared_preload_libraries, max_parallel_workers_per_gather
            // can be restricted or require restart/superuser. Avoid setting here to reduce noisy errors.
        };

        foreach (var sql in optimizations)
            try
            {
                await context.Database.ExecuteSqlRawAsync(sql);
                _logger.LogDebug("Applied optimization: {Sql}", sql);
            }
            catch (PostgresException pgex)
            {
                // Expected on managed services or without privileges
                _logger.LogDebug(pgex, "Skipping optimization (not permitted): {Sql}", sql);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping optimization due to error: {Sql}", sql);
            }
    }

    private async Task OptimizeAutovacuum(SmoContext context)
    {
        try
        {
            // Optimize autovacuum for route_points table (high insert/delete volume)
            await context.Database.ExecuteSqlRawAsync("""
                                                      ALTER TABLE route_points SET (
                                                          autovacuum_vacuum_scale_factor = 0.1,
                                                          autovacuum_analyze_scale_factor = 0.05,
                                                          autovacuum_vacuum_cost_delay = 10,
                                                          autovacuum_vacuum_cost_limit = 1000
                                                      )
                                                      """);

            _logger.LogInformation("Optimized autovacuum settings for high-traffic tables (if permitted)");
        }
        catch (PostgresException pgex)
        {
            _logger.LogDebug(pgex, "Skipping autovacuum tuning (not permitted)");
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Skipping autovacuum tuning");
        }
    }

    private async Task ConfigureWALSettings(SmoContext context)
    {
        var walOptimizations = new[]
        {
            // The following require superuser/ALTER SYSTEM and may not be permitted.
            "ALTER SYSTEM SET wal_buffers = '64MB'",
            "ALTER SYSTEM SET wal_writer_delay = '200ms'",
            "ALTER SYSTEM SET checkpoint_timeout = '15min'",
            "ALTER SYSTEM SET max_wal_size = '4GB'",
            "ALTER SYSTEM SET wal_compression = 'on'"
        };

        foreach (var sql in walOptimizations)
            try
            {
                await context.Database.ExecuteSqlRawAsync(sql);
                _logger.LogDebug("Applied WAL optimization: {Sql}", sql);
            }
            catch (PostgresException pgex)
            {
                _logger.LogDebug(pgex, "Skipping WAL optimization (not permitted): {Sql}", sql);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Skipping WAL optimization: {Sql}", sql);
            }

        try
        {
            await context.Database.ExecuteSqlRawAsync("SELECT pg_reload_conf()");
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Failed to reload PostgreSQL configuration");
        }
    }
}