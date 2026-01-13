using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.OpenApi;
using Newtonsoft.Json;
using Prometheus;
using Prometheus.SystemMetrics;
using Scalar.AspNetCore;
using SMOBackend.Analytics;
using SMOBackend.Data;
using SMOBackend.HealthChecks;
using SMOBackend.Hubs;
using SMOBackend.Services;
using SMOBackend.Services.ApiClients;
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
                    StdUtils.GetEnvVar("FRONTEND_URL", "https://smo.data-unknown.com")
                )
                .SetPreflightMaxAge(TimeSpan.FromHours(2))
    ); // Maximum value most browsers support
});

builder.Services.AddHttpCacheHeaders();

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

            if (StdUtils.GetEnvVar("ASPNETCORE_ENVIRONMENT", "") != "Development")
            {
                doc.Servers?.Clear();
            }

            doc.Servers?.Add(
                new()
                {
                    Url = "https://api.smo.data-unknown.com",
                    Description = "Production server",
                }
            );

            // Add Monitoring tag to the document
            doc.Tags ??= new HashSet<OpenApiTag>();
            var monitoringTag = new OpenApiTag { Name = "Monitoring", Description = "Health and metrics endpoints" };
            doc.Tags.Add(monitoringTag);

            // Add metrics endpoint to OpenAPI documentation
            var metricsPath = new OpenApiPathItem();
            metricsPath.AddOperation(HttpMethod.Get, new()
            {
                Tags = new HashSet<OpenApiTagReference> { new("Monitoring", doc) },
                Summary = "Get Prometheus metrics",
                Description = "Returns all Prometheus metrics in text format",
                Responses = new()
                {
                    ["200"] = new OpenApiResponse
                    {
                        Description = "Prometheus metrics in text format",
                        Content = new Dictionary<string, OpenApiMediaType>
                        {
                            ["text/plain"] = new()
                            {
                                Schema = new OpenApiSchema
                                {
                                    Type = JsonSchemaType.String,
                                    Example =
                                        "# HELP smo_train_count Number of trains\n# TYPE smo_train_count gauge\nsmo_train_count{server=\"int1\"} 0\n"
                                }
                            }
                        }
                    }
                }
            });
            doc.Paths["/metrics"] = metricsPath;

            // Add health check endpoint to OpenAPI documentation
            var healthPath = new OpenApiPathItem();
            healthPath.AddOperation(HttpMethod.Get, new()
            {
                Tags = new HashSet<OpenApiTagReference> { new("Monitoring", doc) },
                Summary = "Get health check",
                Description = "Returns the health status of the application",
                Responses = new()
                {
                    ["200"] = new OpenApiResponse
                    {
                        Description = "Health check response",
                        Content = new Dictionary<string, OpenApiMediaType>
                        {
                            ["text/plain"] = new()
                            {
                                Schema = new OpenApiSchema
                                {
                                    Type = JsonSchemaType.String,
                                    Example = "Healthy"
                                }
                            }
                        }
                    }
                }
            });
            doc.Paths["/health"] = healthPath;

            return Task.CompletedTask;
        }
    );
}).AddSwaggerGenNewtonsoftSupport();

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

var envConn = StdUtils.GetEnvVar("DATABASE_URL", "");
var connectionString = string.IsNullOrWhiteSpace(envConn)
    ? builder.Configuration.GetConnectionString("DefaultConnection")
    : envConn;

if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "No connection string provided. Set DATABASE_URL or DefaultConnection."
    );

// Limit DbContext pool size for smaller memory footprint
var dbContextPoolSize = StdUtils.GetEnvVar("DB_CONTEXT_POOL_SIZE", 32);
if (dbContextPoolSize <= 0) dbContextPoolSize = 32;

// Configure a small EF memory cache (note: size units require entry sizes to be set to be enforced)
var efCacheSizeMb = StdUtils.GetEnvVar("EF_MEMORY_CACHE_SIZE_MB", 64);
if (efCacheSizeMb <= 0) efCacheSizeMb = 64;
var efCache = new MemoryCache(new MemoryCacheOptions
{
    SizeLimit = efCacheSizeMb * 1024L * 1024L
});

builder.Services.AddDbContextPool<SmoContext>(options =>
        options
            .UseNpgsql(
                connectionString,
                o => o.UseNetTopologySuite().ConfigureDataSource(dso => dso.Name = "smo-backend")
            )
            .EnableSensitiveDataLogging(builder.Environment.IsDevelopment())
            .UseMemoryCache(efCache)
            .UseSnakeCaseNamingConvention()
    , dbContextPoolSize);

builder.Services.AddSingleton<SimrailApiClient>();
builder.Services.AddSingleton<OsmApiClient>();

var steamApiKey = StdUtils.GetEnvVar("STEAM_API_KEY", "");

builder.Services.AddSingleton(new SteamApiClient(steamApiKey));

var xblIoApiKey = StdUtils.GetEnvVar("XBLIO_API_KEY", "");

builder.Services.AddSingleton(new XblIoApiClient(xblIoApiKey));

// Data services - High Priority (critical for application functionality)
builder.Services.AddHighPriorityHostedService<ServerDataService>();
builder.Services.AddHighPriorityHostedService<TrainDataService>();
builder.Services.AddHighPriorityHostedService<TrainPositionDataService>();
builder.Services.AddHighPriorityHostedService<StationDataService>();
builder.Services.AddHighPriorityHostedService<TimeDataService>();
builder.Services.AddHighPriorityHostedService<TimetableDataService>();
builder.Services.AddHighPriorityHostedService<TrainTypeService>();

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