using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddSignalPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Primary indexes for signal_connections table to optimize the JOINs
            migrationBuilder.CreateIndex(
                name: "IX_signal_connections_next",
                table: "signal_connections",
                column: "next");

            migrationBuilder.CreateIndex(
                name: "IX_signal_connections_prev",
                table: "signal_connections",
                column: "prev");

            // Composite indexes for even better performance on the specific JOIN patterns
            migrationBuilder.CreateIndex(
                name: "IX_signal_connections_next_vmax",
                table: "signal_connections",
                columns: new[] { "next", "vmax" });

            migrationBuilder.CreateIndex(
                name: "IX_signal_connections_prev_vmax",
                table: "signal_connections",
                columns: new[] { "prev", "vmax" });

            // Index on signals.name for faster grouping (if not already primary key)
            migrationBuilder.CreateIndex(
                name: "IX_signals_name_covering",
                table: "signals",
                column: "name")
                .Annotation("Npgsql:IndexInclude", new[] { "extra", "accuracy", "type", "role", "prev_finalized", "next_finalized", "prev_regex", "next_regex" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_signal_connections_next",
                table: "signal_connections");

            migrationBuilder.DropIndex(
                name: "IX_signal_connections_prev",
                table: "signal_connections");

            migrationBuilder.DropIndex(
                name: "IX_signal_connections_next_vmax",
                table: "signal_connections");

            migrationBuilder.DropIndex(
                name: "IX_signal_connections_prev_vmax",
                table: "signal_connections");

            migrationBuilder.DropIndex(
                name: "IX_signals_name_covering",
                table: "signals");
        }
    }
}
