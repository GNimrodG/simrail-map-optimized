using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class SignalBlockingConnections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "blocking_connections",
                table: "signals",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "blocking_connections",
                table: "signals");
        }
    }
}
