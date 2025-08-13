using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Composite indexes for route points - most commonly queried together
            migrationBuilder.Sql(@"
                CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_route_points_route_run_train 
                ON route_points (route_id, run_id, train_id);
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_route_points_created_at_desc 
                ON route_points (created_at DESC);
            ");

            migrationBuilder.Sql(@"
                CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_route_points_signals 
                ON route_points (next_signal, prev_signal) 
                WHERE next_signal IS NOT NULL OR prev_signal IS NOT NULL;
            ");

            // Partial indexes for active data only (last 24 hours)
            migrationBuilder.Sql(@"
                CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_route_points_recent_spatial 
                ON route_points USING GIST (point) 
                WHERE created_at > (NOW() - INTERVAL '24 hours');
            ");

            // Index for cleanup queries
            migrationBuilder.Sql(@"
                CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_route_points_cleanup 
                ON route_points (route_id, train_id, run_id, created_at DESC);
            ");

            // Covering index for distance calculations
            migrationBuilder.Sql(@"
                CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_route_points_distance_calc 
                ON route_points (route_id, run_id, train_id, created_at) 
                INCLUDE (point);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_route_points_route_run_train;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_route_points_created_at_desc;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_route_points_signals;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_route_points_recent_spatial;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_route_points_cleanup;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_route_points_distance_calc;");
        }
    }
}
