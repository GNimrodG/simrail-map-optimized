using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class SignalLine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "signal_lines",
                columns: table => new
                {
                    prev_signal = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    next_signal = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    line = table.Column<LineString>(type: "Geometry(LineString, 4326)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_signal_lines", x => new { x.prev_signal, x.next_signal });
                });

            migrationBuilder.CreateIndex(
                name: "ix_route_points_prev_signal_next_signal",
                table: "route_points",
                columns: new[] { "prev_signal", "next_signal" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "signal_lines");

            migrationBuilder.DropIndex(
                name: "ix_route_points_prev_signal_next_signal",
                table: "route_points");
        }
    }
}
