using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class OptimizeSignalAnalyzerQuery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Optimized covering index for signal analyzer query
            // This index includes all commonly queried fields to avoid table lookups
            migrationBuilder.CreateIndex(
                name: "IX_signals_name_analyzer_covering",
                table: "signals",
                column: "name")
                .Annotation("Npgsql:IndexInclude", new[] { 
                    "accuracy", "type", "prev_finalized", "next_finalized", 
                    "prev_regex", "next_regex" 
                });

            // Optimized index for signal connections with all needed fields
            migrationBuilder.CreateIndex(
                name: "IX_signal_connections_next_with_data",
                table: "signal_connections",
                column: "next")
                .Annotation("Npgsql:IndexInclude", new[] { "prev", "vmax" });

            migrationBuilder.CreateIndex(
                name: "IX_signal_connections_prev_with_data",
                table: "signal_connections",
                column: "prev")
                .Annotation("Npgsql:IndexInclude", new[] { "next", "vmax" });

            // Additional B-tree index for efficient WHERE IN queries with signal names
            migrationBuilder.CreateIndex(
                name: "IX_signals_name_btree_optimized",
                table: "signals",
                column: "name")
                .Annotation("Npgsql:IndexMethod", "btree");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_signals_name_analyzer_covering",
                table: "signals");

            migrationBuilder.DropIndex(
                name: "IX_signal_connections_next_with_data",
                table: "signal_connections");

            migrationBuilder.DropIndex(
                name: "IX_signal_connections_prev_with_data",
                table: "signal_connections");

            migrationBuilder.DropIndex(
                name: "IX_signals_name_btree_optimized",
                table: "signals");
        }
    }
}
