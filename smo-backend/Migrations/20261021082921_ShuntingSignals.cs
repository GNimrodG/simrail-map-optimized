using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMOBackend.Migrations
{
    /// <inheritdoc />
    public partial class ShuntingSignals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // shunting signals look like main signals by name, see Signal.SHUNTING_SIGNAL_REGEX
            migrationBuilder.Sql("""
                                    UPDATE signals
                                    SET type = 'shunting'
                                    WHERE name ~ '^.+_Tm[0-9]+[a-z]?$';
                                 """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                                    UPDATE signals
                                    SET type = 'main'
                                    WHERE type = 'shunting';
                                 """);
        }
    }
}
