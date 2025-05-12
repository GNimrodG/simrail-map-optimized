using System.ComponentModel;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using SMOBackend.Models;
using SMOBackend.Models.Entity;
using SMOBackend.Utils;

namespace SMOBackend.Data;

public class SmoContext(DbContextOptions<SmoContext> options) : DbContext(options)
{
    public DbSet<Signal> Signals { get; set; }
    public DbSet<SignalConnection> SignalConnections { get; set; }
    public DbSet<SignalConnectionError> SignalConnectionErrors { get; set; }

    internal DbSet<Stat> Stats { get; set; }

    public DbSet<RoutePoint> RoutePoints { get; set; }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                var memberInfo = property.PropertyInfo ?? (MemberInfo?)property.FieldInfo;
                if (memberInfo == null) continue;

                if (Attribute.GetCustomAttribute(memberInfo, typeof(DefaultValueAttribute))
                    is DefaultValueAttribute defaultValue)
                {
                    if (defaultValue.Value != null && memberInfo.GetUnderlyingType() == defaultValue.Value.GetType())
                        property.SetDefaultValue(defaultValue.Value);
                    else
                        property.SetDefaultValueSql(defaultValue.Value?.ToString() ?? "NULL");
                }
            }
        }

        builder.HasPostgresExtension("postgis");

        builder.Entity<Signal>()
            .HasIndex(s => s.Location)
            .HasMethod("gist");

        // Signal.NextSignalConnections (Signal.Name) *-1 SignalConnection.PrevSignal (SignalConnection.Prev)
        builder.Entity<SignalConnection>()
            .HasOne(c => c.PrevSignal)
            .WithMany(s => s.NextSignalConnections)
            .HasForeignKey(c => c.Prev)
            .HasPrincipalKey(s => s.Name)
            .OnDelete(DeleteBehavior.Cascade);

        // Signal.PrevSignalConnections (Signal.Name) *-1 SignalConnection.NextSignal (SignalConnection.Next)
        builder.Entity<SignalConnection>()
            .HasOne(c => c.NextSignal)
            .WithMany(s => s.PrevSignalConnections)
            .HasForeignKey(c => c.Next)
            .HasPrincipalKey(c => c.Name)
            .OnDelete(DeleteBehavior.Cascade);

        // SignalConnection.Prev != SignalConnection.Next
        builder.Entity<SignalConnection>()
            .ToTable(t => t.HasCheckConstraint("ck_signal_connections_prev_next_not_same", "prev <> next"));

        builder.Entity<RoutePoint>()
            .HasIndex(rp => rp.Point)
            .HasMethod("gist");
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        SavingChanges += (_, _) =>
        {
            foreach (var entry in ChangeTracker.Entries())
            {
                switch (entry.State)
                {
                    case EntityState.Added:
                    {
                        if (entry.Entity is BaseEntity entity)
                        {
                            entity.CreatedAt = DateTime.UtcNow;
                            entity.UpdatedAt = DateTime.UtcNow;
                        }

                        break;
                    }
                    case EntityState.Modified:
                    {
                        if (entry.Entity is BaseEntity entity)
                        {
                            entity.UpdatedAt = DateTime.UtcNow;
                        }

                        break;
                    }
                }
            }
        };
    }
}