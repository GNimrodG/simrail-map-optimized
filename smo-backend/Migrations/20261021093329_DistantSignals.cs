using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class DistantSignals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // distant signals look like main signals by name, see Signal.DISTANT_SIGNAL_REGEX
            migrationBuilder.Sql("""
                                    UPDATE signals
                                    SET type = 'distant'
                                    WHERE name ~ '^.+_To[A-Z][A-Za-z0-9]*$';
                                 """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                                    UPDATE signals
                                    SET type = 'main'
                                    WHERE type = 'distant';
                                 """);
        }
    }
}
