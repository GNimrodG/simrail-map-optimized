using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "route_points",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    route_id = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    run_id = table.Column<string>(type: "character varying(36)", maxLength: 36, nullable: false),
                    train_id = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    point = table.Column<Point>(type: "Geometry(Point, 4326)", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_route_points", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "signal_connection_errors",
                columns: table => new
                {
                    prev = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    next = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    vmax = table.Column<short>(type: "smallint", nullable: false),
                    @checked = table.Column<bool>(name: "checked", type: "boolean", nullable: false, defaultValue: false),
                    distance = table.Column<double>(type: "DOUBLE PRECISION", nullable: false),
                    created_by = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_signal_connection_errors", x => new { x.prev, x.next, x.error });
                });

            migrationBuilder.CreateTable(
                name: "signals",
                columns: table => new
                {
                    name = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    extra = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    location = table.Column<Point>(type: "Geometry(Point, 4326)", nullable: false),
                    accuracy = table.Column<double>(type: "double precision", nullable: false),
                    type = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    prev_regex = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    next_regex = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    prev_finalized = table.Column<bool>(type: "boolean", nullable: false),
                    next_finalized = table.Column<bool>(type: "boolean", nullable: false),
                    created_by = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_signals", x => x.name);
                });

            migrationBuilder.CreateTable(
                name: "stats",
                columns: table => new
                {
                    service_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    duration = table.Column<int>(type: "integer", nullable: false),
                    count = table.Column<int>(type: "integer", nullable: false),
                    server_count = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stats", x => new { x.service_id, x.created_at });
                });

            migrationBuilder.CreateTable(
                name: "signal_connections",
                columns: table => new
                {
                    prev = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    next = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    distance = table.Column<double>(type: "DOUBLE PRECISION", nullable: false),
                    vmax = table.Column<short>(type: "smallint", nullable: true),
                    created_by = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_signal_connections", x => new { x.prev, x.next });
                    table.CheckConstraint("ck_signal_connections_prev_next_not_same", "prev <> next");
                    table.ForeignKey(
                        name: "fk_signal_connections_signals_next",
                        column: x => x.next,
                        principalTable: "signals",
                        principalColumn: "name",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_signal_connections_signals_prev",
                        column: x => x.prev,
                        principalTable: "signals",
                        principalColumn: "name",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_route_points_point",
                table: "route_points",
                column: "point")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "ix_route_points_route_id",
                table: "route_points",
                column: "route_id");

            migrationBuilder.CreateIndex(
                name: "ix_route_points_route_id_run_id_train_id",
                table: "route_points",
                columns: new[] { "route_id", "run_id", "train_id" });

            migrationBuilder.CreateIndex(
                name: "ix_signal_connections_next",
                table: "signal_connections",
                column: "next");

            migrationBuilder.CreateIndex(
                name: "ix_signal_connections_prev",
                table: "signal_connections",
                column: "prev");

            migrationBuilder.CreateIndex(
                name: "ix_signals_location",
                table: "signals",
                column: "location")
                .Annotation("Npgsql:IndexMethod", "gist");
            
            migrationBuilder.Sql("""
                                 CREATE OR REPLACE FUNCTION get_signal_distance(signal1 CHARACTER VARYING, signal2 CHARACTER VARYING) RETURNS DOUBLE PRECISION
                                     LANGUAGE plpgsql
                                 AS
                                 $$
                                 DECLARE
                                     point1   GEOMETRY;
                                     point2   GEOMETRY;
                                     distance DOUBLE PRECISION;
                                 BEGIN
                                     SELECT location INTO point1 FROM signals WHERE name = signal1;
                                     SELECT location INTO point2 FROM signals WHERE name = signal2;
                                     distance := ST_DistanceSphere(point1, point2);
                                     RETURN distance;
                                 END;
                                 $$;

                                 CREATE OR REPLACE FUNCTION set_signal_distance_before_insert() RETURNS trigger
                                     LANGUAGE plpgsql
                                 AS
                                 $$
                                 BEGIN
                                     NEW.distance = get_signal_distance(NEW.prev, NEW.next);
                                     RETURN NEW;
                                 END;
                                 $$;

                                 CREATE TRIGGER set_prev_signal_distance_before_insert
                                     BEFORE INSERT
                                     ON signal_connections
                                     FOR EACH ROW
                                 EXECUTE PROCEDURE set_signal_distance_before_insert();
                                 """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                                 DROP TRIGGER set_prev_signal_distance_before_insertON signal_connections;
                                 DROP FUNCTION set_signal_distance_before_insert;
                                 DROP FUNCTION get_signal_distance;
                                 """);
            
            migrationBuilder.DropTable(
                name: "route_points");

            migrationBuilder.DropTable(
                name: "signal_connection_errors");

            migrationBuilder.DropTable(
                name: "signal_connections");

            migrationBuilder.DropTable(
                name: "stats");

            migrationBuilder.DropTable(
                name: "signals");
        }
    }
}
