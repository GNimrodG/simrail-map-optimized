using FluentAssertions;
using SMOBackend.Utils;

namespace SMOBackend.Tests.Utils;

/// <summary>
///     Unit tests for <see cref="StdUtils" /> utility methods.
/// </summary>
public class StdUtilsTests
{
    // ──────────────────────────────────────────────
    //  GetEnvVar Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void GetEnvVar_ReturnsDefaultValue_WhenVariableNotSet()
    {
        var nonExistentVar = $"TEST_VAR_{Guid.NewGuid():N}";

        var result = StdUtils.GetEnvVar(nonExistentVar, 42);

        result.Should().Be(42);
    }

    [Fact]
    public void GetEnvVar_ReturnsDefaultValue_WhenVariableIsEmpty()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "");

        try
        {
            var result = StdUtils.GetEnvVar(varName, 42);
            result.Should().Be(42);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVar_ParsesIntValue()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "123");

        try
        {
            var result = StdUtils.GetEnvVar(varName, 0);
            result.Should().Be(123);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVar_ParsesDoubleValue()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "123.45");

        try
        {
            var result = StdUtils.GetEnvVar(varName, 0.0);
            result.Should().Be(123.45);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVar_ParsesBoolValue_True()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "true");

        try
        {
            var result = StdUtils.GetEnvVar(varName, false);
            result.Should().BeTrue();
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVar_ParsesBoolValue_False()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "false");

        try
        {
            var result = StdUtils.GetEnvVar(varName, true);
            result.Should().BeFalse();
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVar_ParsesStringValue()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "test_value");

        try
        {
            var result = StdUtils.GetEnvVar(varName, "default");
            result.Should().Be("test_value");
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVar_ReturnsDefaultValue_WhenConversionFails()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "not_a_number");

        try
        {
            var result = StdUtils.GetEnvVar(varName, 42);
            result.Should().Be(42);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVar_HandlesNegativeNumbers()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "-100");

        try
        {
            var result = StdUtils.GetEnvVar(varName, 0);
            result.Should().Be(-100);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    // ──────────────────────────────────────────────
    //  GetEnvVarDuration Tests
    // ──────────────────────────────────────────────

    [Fact]
    public void GetEnvVarDuration_ReturnsDefaultValue_WhenVariableNotSet()
    {
        var nonExistentVar = $"TEST_VAR_{Guid.NewGuid():N}";
        var defaultValue = TimeSpan.FromMinutes(5);

        var result = StdUtils.GetEnvVarDuration(nonExistentVar, defaultValue);

        result.Should().Be(defaultValue);
    }

    [Fact]
    public void GetEnvVarDuration_ReturnsDefaultValue_WhenVariableIsEmpty()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        var defaultValue = TimeSpan.FromMinutes(5);
        Environment.SetEnvironmentVariable(varName, "");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, defaultValue);
            result.Should().Be(defaultValue);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVarDuration_ParsesTimeSpanFormat()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "00:05:30");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, TimeSpan.Zero);
            result.Should().Be(TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(30)));
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVarDuration_ParsesIntegerSeconds()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "120");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, TimeSpan.Zero);
            result.Should().Be(TimeSpan.FromSeconds(120));
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVarDuration_ParsesDoubleSeconds()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "90.5");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, TimeSpan.Zero);
            result.Should().Be(TimeSpan.FromSeconds(90.5));
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVarDuration_ReturnsDefaultValue_WhenNegativeSeconds()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        var defaultValue = TimeSpan.FromMinutes(5);
        Environment.SetEnvironmentVariable(varName, "-10");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, defaultValue);
            result.Should().Be(defaultValue);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVarDuration_ReturnsDefaultValue_WhenInvalidFormat()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        var defaultValue = TimeSpan.FromMinutes(5);
        Environment.SetEnvironmentVariable(varName, "invalid");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, defaultValue);
            result.Should().Be(defaultValue);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVarDuration_AcceptsZero()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "0");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, TimeSpan.FromMinutes(5));
            result.Should().Be(TimeSpan.Zero);
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }

    [Fact]
    public void GetEnvVarDuration_ParsesComplexTimeSpan()
    {
        var varName = $"TEST_VAR_{Guid.NewGuid():N}";
        Environment.SetEnvironmentVariable(varName, "1.02:03:04.500");

        try
        {
            var result = StdUtils.GetEnvVarDuration(varName, TimeSpan.Zero);
            result.Should().Be(new(1, 2, 3, 4, 500));
        }
        finally
        {
            Environment.SetEnvironmentVariable(varName, null);
        }
    }
}