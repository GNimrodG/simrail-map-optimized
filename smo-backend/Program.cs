using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Newtonsoft.Json;
using Prometheus;
using Prometheus.SystemMetrics;
using Scalar.AspNetCore;
using SMOBackend.Analytics;
using SMOBackend.Data;
using SMOBackend.HealthChecks;
using SMOBackend.Hubs;
using SMOBackend.Services;
using SMOBackend.Utils;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "AllowLocalAndProduction",
        policyBuilder =>
            policyBuilder
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()
                .WithOrigins(
                    "http://localhost:5173",
                    "http://locahost:4173",
                    Environment.GetEnvironmentVariable("FRONTEND_URL")
                    ?? "https://smo.data-unknown.com"
                )
                .SetPreflightMaxAge(TimeSpan.FromHours(2))
    ); // Maximum value most browsers support
});

builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore;
        options.SerializerSettings.NullValueHandling = NullValueHandling.Ignore;
        options.SerializerSettings.Converters.Add(new PointJsonConverter());
    });

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((doc, _, _) =>
        {
            doc.Info.Title = "SMO Backend API";
            doc.Info.Version = "v1";
            doc.Info.Description = "API for the SMO backend";
            doc.Info.Contact = new()
            {
                Name = "Nimród \"GNimrodG\" Glöckl",
                Email = "g.nimrod.g@data-unknown.com",
                Url = new("https://github.com/GNimrodG/"),
            };
            doc.Info.License = new()
            {
                Name = "AGPL-3.0",
                Url = new("https://github.com/GNimrodG/simrail-map-optimized/blob/master/LICENSE"),
            };

            if (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") != "Development")
                doc.Servers = new List<OpenApiServer>();

            doc.Servers.Add(
                new()
                {
                    Url = "https://api.smo.data-unknown.com",
                    Description = "Production server",
                }
            );

            // Add metrics endpoint to OpenAPI documentation
            var metricsPath = new OpenApiPathItem();
            metricsPath.AddOperation(
                OperationType.Get,
                new()
                {
                    Tags = [new() { Name = "Monitoring" }],
                    Summary = "Get Prometheus metrics",
                    Description = "Returns all Prometheus metrics in text format",
                    Responses = new()
                    {
                        ["200"] = new()
                        {
                            Description = "Prometheus metrics in text format",
                            Content = new Dictionary<string, OpenApiMediaType>
                            {
                                ["text/plain"] = new()
                                {
                                    Schema = new()
                                    {
                                        Type = "string",
                                        Example = new OpenApiString(
                                            "# HELP smo_train_count Number of trains\n# TYPE smo_train_count gauge\nsmo_train_count{server=\"int1\"} 0\n"
                                        ),
                                    }
                                }
                            }
                        }
                    }
                }
            );
            doc.Paths["/metrics"] = metricsPath;

            // Add health check endpoint to OpenAPI documentation
            var healthPath = new OpenApiPathItem();
            healthPath.AddOperation(
                OperationType.Get,
                new()
                {
                    Tags = [new() { Name = "Monitoring" }],
                    Summary = "Get health check",
                    Description = "Returns the health status of the application",
                    Responses = new()
                    {
                        ["200"] = new()
                        {
                            Description = "Health check response",
                            Content = new Dictionary<string, OpenApiMediaType>
                            {
                                ["text/plain"] = new()
                                {
                                    Schema = new()
                                    {
                                        Type = "string",
                                        Example = new OpenApiString("Healthy"),
                                    }
                                }
                            }
                        }
                    }
                }
            );
            doc.Paths["/health"] = healthPath;

            return Task.CompletedTask;
        }
    );
});

builder.Services.AddSignalR().AddMessagePackProtocol();

builder.Services.AddLogging(loggingBuilder =>
{
    loggingBuilder.AddSimpleConsole(options =>
    {
        options.IncludeScopes = true;
        options.SingleLine = true;
        options.TimestampFormat = "[HH:mm:ss] ";
    });
});

var connectionString =
    Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? builder.Configuration.GetConnectionString("DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "No connection string provided. Set DATABASE_URL or DefaultConnection."
    );

builder.Services.AddDbContextPool<SmoContext>(options =>
    options
        .UseNpgsql(
            connectionString,
            o => o.UseNetTopologySuite().ConfigureDataSource(dso => dso.Name = "smo-backend")
        )
        .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
        .UseMemoryCache(
            new MemoryCache(
                new MemoryCacheOptions
                {
                    SizeLimit = 1024 * 1024 * 1024, // 1 GB
                }
            )
        )
        .UseSnakeCaseNamingConvention()
);

builder.Services.AddSingleton<SimrailApiClient>();
builder.Services.AddSingleton<OsmApiClient>();

var steamApiKey = Environment.GetEnvironmentVariable("STEAM_API_KEY")
                  ?? builder.Configuration.GetValue<string>("SteamApiKey")
                  ?? "";

builder.Services.AddSingleton(new SteamApiClient(steamApiKey));

// Data services - High Priority (critical for application functionality)
builder.Services.AddHighPriorityHostedService<ServerDataService>();
builder.Services.AddHighPriorityHostedService<TrainDataService>();
builder.Services.AddHighPriorityHostedService<TrainPositionDataService>();
builder.Services.AddHighPriorityHostedService<StationDataService>();
builder.Services.AddHighPriorityHostedService<TimeDataService>();
builder.Services.AddHighPriorityHostedService<TimetableDataService>();

// Analytic services - Low Priority (background processing)
builder.Services.AddLowPriorityHostedService<SignalAnalyzerService>();
builder.Services.AddLowPriorityHostedService<TrainDelayAnalyzerService>();
builder.Services.AddLowPriorityHostedService<TimetableAnalyzerService>();
builder.Services.AddLowPriorityHostedService<RoutePointAnalyzerService>();
builder.Services.AddLowPriorityHostedService<ServerRestartAnalyzerService>();
builder.Services.AddLowPriorityHostedService<StationAnalyzerService>();

// Client services - Normal Priority
builder.Services.AddSingleton<ClientManagerService>();
builder.Services.AddNormalPriorityHostedService<ClientDataSenderService>();

builder.Services.UseHttpClientMetrics();
builder.Services.AddSystemMetrics(false);

builder
    .Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("Database")
    .AddCheck<DataServiceHealthCheck>("Data Services")
    .ForwardToPrometheus();

builder.WebHost.UseSentry();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.MapOpenApi();
app.UseSwaggerUI(options =>
{
    options.DocumentTitle = "SMO Backend API";
    options.SwaggerEndpoint("/openapi/v1.json", "SMO Backend API v1");
});
app.MapScalarApiReference(options =>
{
    options.Title = "SMO Backend API";
    options.DarkMode = true;
    options.Theme = ScalarTheme.DeepSpace;
    options.DotNetFlag = true;
});

app.UseHttpsRedirection();

app.UseCors("AllowLocalAndProduction");

app.Map("/", () => Results.Redirect("/scalar/v1"));
app.MapControllers();
app.MapHub<MainHub>("/signalr");
app.MapHealthChecks("/health");
app.MapMetrics();

app.Run("http://0.0.0.0:3000");