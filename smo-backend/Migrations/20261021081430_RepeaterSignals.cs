using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class RepeaterSignals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // repeater signals look like main signals by name, see Signal.REPEATER_SIGNAL_REGEX
            migrationBuilder.Sql("""
                                    UPDATE signals
                                    SET type = 'repeater'
                                    WHERE name ~ '^.+_(I{1,3}|Y)?Sp[A-Z][A-Za-z0-9]*$';
                                 """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                                    UPDATE signals
                                    SET type = 'main'
                                    WHERE type = 'repeater';
                                 """);
        }
    }
}
