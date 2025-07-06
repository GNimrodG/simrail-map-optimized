using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class RoutePointExtraData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "route_point_id_seq",
                maxValue: 9223372036854775807L,
                cyclic: true);
            
            // set the current value of the sequence to the max id in the table
            migrationBuilder.Sql("SELECT setval('route_point_id_seq', (SELECT COALESCE(MAX(id), 0) FROM route_points))");

            migrationBuilder.AlterColumn<string>(
                name: "run_id",
                table: "route_points",
                type: "character varying(43)",
                maxLength: 43,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(36)",
                oldMaxLength: 36);

            migrationBuilder.AlterColumn<long>(
                name: "id",
                table: "route_points",
                type: "bigint",
                nullable: false,
                defaultValueSql: "nextval('route_point_id_seq')",
                oldClrType: typeof(long),
                oldType: "bigint")
                .OldAnnotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);

            migrationBuilder.AddColumn<bool>(
                name: "inside_play_area",
                table: "route_points",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "next_signal",
                table: "route_points",
                type: "character varying(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "prev_signal",
                table: "route_points",
                type: "character varying(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "server_code",
                table: "route_points",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_route_points_route_id_created_at",
                table: "route_points",
                columns: new[] { "route_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_route_points_route_id_created_at",
                table: "route_points");

            migrationBuilder.DropColumn(
                name: "inside_play_area",
                table: "route_points");

            migrationBuilder.DropColumn(
                name: "next_signal",
                table: "route_points");

            migrationBuilder.DropColumn(
                name: "prev_signal",
                table: "route_points");

            migrationBuilder.DropColumn(
                name: "server_code",
                table: "route_points");

            migrationBuilder.DropSequence(
                name: "route_point_id_seq");

            migrationBuilder.AlterColumn<string>(
                name: "run_id",
                table: "route_points",
                type: "character varying(36)",
                maxLength: 36,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(43)",
                oldMaxLength: 43);

            migrationBuilder.AlterColumn<long>(
                name: "id",
                table: "route_points",
                type: "bigint",
                nullable: false,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldDefaultValueSql: "nextval('route_point_id_seq')")
                .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn);
        }
    }
}
