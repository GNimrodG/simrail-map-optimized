using System.ComponentModel;
using System.Reflection;
using Microsoft.EntityFrameworkCore;
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

    public DbSet<SignalLine> SignalLines { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
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

        modelBuilder.HasPostgresExtension("postgis");

        // Create a cyclical sequence for RoutePoint Id
        modelBuilder.HasSequence<long>("route_point_id_seq")
            .StartsAt(1)
            .IncrementsBy(1)
            .HasMax(long.MaxValue)
            .IsCyclic();

        modelBuilder.Entity<Signal>()
            .HasIndex(s => s.Location)
            .HasMethod("gist");

        // Signal.NextSignalConnections (Signal.Name) *-1 SignalConnection.PrevSignal (SignalConnection.Prev)
        modelBuilder.Entity<SignalConnection>()
            .HasOne(c => c.PrevSignal)
            .WithMany(s => s.NextSignalConnections)
            .HasForeignKey(c => c.Prev)
            .HasPrincipalKey(s => s.Name)
            .OnDelete(DeleteBehavior.Cascade);

        // Signal.PrevSignalConnections (Signal.Name) *-1 SignalConnection.NextSignal (SignalConnection.Next)
        modelBuilder.Entity<SignalConnection>()
            .HasOne(c => c.NextSignal)
            .WithMany(s => s.PrevSignalConnections)
            .HasForeignKey(c => c.Next)
            .HasPrincipalKey(s => s.Name)
            .OnDelete(DeleteBehavior.Cascade);

        // SignalConnection.Prev != SignalConnection.Next
        modelBuilder.Entity<SignalConnection>()
            .ToTable(t => t.HasCheckConstraint("ck_signal_connections_prev_next_not_same", "prev <> next"));

        modelBuilder.Entity<RoutePoint>()
            .HasIndex(rp => rp.Point)
            .HasMethod("gist");

        // Configure RoutePoint to use the cyclical sequence
        modelBuilder.Entity<RoutePoint>()
            .Property(rp => rp.Id)
            .HasDefaultValueSql("nextval('route_point_id_seq')");
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