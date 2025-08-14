# Simrail Map Optimalized (SMO)

[![Frontend](https://github.com/GNimrodG/simrail-map-optimized/actions/workflows/build-frontend.yml/badge.svg)](https://github.com/GNimrodG/simrail-map-optimized/actions/workflows/build-frontend.yml)
[![Backend](https://github.com/GNimrodG/simrail-map-optimized/actions/workflows/build-backend.yml/badge.svg)](https://github.com/GNimrodG/simrail-map-optimized/actions/workflows/build-backend.yml)

## This project hosted at [https://smo.data-unknown.com](https://smo.data-unknown.com/)

## Table of Contents

- [Description](#description)
- [Features](#features)
- [Installation](#installation)
  - [Frontend](#frontend)
  - [Backend](#backend)
- [Environment variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)
- [Authors](#authors)
- [Acknowledgments](#acknowledgments)

## Description

This is a project that aims to provide an optimalized and feature rich online map for the game Simrail.

## Features

- **Signal display**
- **Delay tracking**
- Train schedule display
- Train route display

## Installation

1. Clone the repository with `git clone https://github.com/GNimrodG/simrail-map-optimized.git` or download the repository as a zip file

### Frontend

1. Navigate to the `smo-frontend` directory
2. Run `yarn install` to install the dependencies
3. Run `yarn dev` to start the development server
4. Open `http://localhost:5173/` in your browser (by default when running in development mode the frontend will try to use the backend running on `http://localhost:3000/`)

### Backend

To run the backend you need a PostGIS database running, you can use an external one or you can use the `docker-compose.yml` file to run one locally in Docker. (You need comment out the webserver part in the `docker-compose.yml` file to avoid port conflicts.)

1. Navigate to the `smo-backend` directory
2. Make sure you have the .NET 9.0 SDK installed
3. Configure your connection string and other settings either in:
   - `appsettings.Development.json` for local development
   - Environment variables (especially for production deployment)
   - .NET User Secrets for local development (`dotnet user-secrets set "ConnectionStrings:DefaultConnection" "your-connection-string"`)
4. Run `dotnet restore` to restore the required packages
5. Run `dotnet run` to start the development server
6. The backend server will be running on `http://localhost:3000/`

You can also open the solution in Visual Studio 2022 or JetBrains Rider for a more integrated development experience.

## Environment variables

Backend supports configuring behavior via environment variables (values in parentheses are defaults).

Core and hosting

- `DATABASE_URL`: PostgreSQL connection string (overrides `ConnectionStrings:DefaultConnection`)
- `FRONTEND_URL`: CORS origin for the frontend (`https://smo.data-unknown.com`)
- `ASPNETCORE_ENVIRONMENT`: Standard .NET environment (`Development`/`Production`)
- `ADMIN_PASSWORD`: Enables protected admin endpoints when set
- `STEAM_API_KEY`: Optional Steam API key for player stats (`""`)

Performance and memory

- `DB_CONTEXT_POOL_SIZE`: EF Core DbContext pool size (`32`)
- `EF_MEMORY_CACHE_SIZE_MB`: EF internal memory cache size in MB (`64`)

Service polling intervals

- `{SERVICE}_REFRESH_INTERVAL`: Polling interval per service. Accepts TimeSpan (e.g. `00:00:05`) or seconds (e.g. `5`).
  Services:
    - `SERVER_REFRESH_INTERVAL` (default `00:00:30`)
    - `TRAIN_REFRESH_INTERVAL` (default `00:00:05`)
    - `TRAIN-POS_REFRESH_INTERVAL` (default `00:00:01`)
    - `TIMETABLE_REFRESH_INTERVAL` (default `01:00:00` = 1 hour)
    - `TIME_REFRESH_INTERVAL` (default `00:05:00` = 5 minutes)
    - `STATION_REFRESH_INTERVAL` (default `00:00:05`)

Signal analyzer

- `SIGNAL_BUFFER_DISTANCE_BETWEEN`: Extra buffer (meters) in movement validation (`50`)
- `SIGNAL_MIN_DISTANCE_BETWEEN`: Min distance between signals (meters) (`200`)
- `SIGNAL_MIN_DISTANCE`: Distance threshold to treat a train as at a signal (meters) (`100`)
- `TRAIN_CACHE_MAX_ENTRIES`: Capacity of in-memory train->last-signal cache (`-1` = unlimited)
- `TRAIN_PASSED_CACHE_MAX_ENTRIES`: Capacity of passed-signal cache (`-1` = unlimited)
- `TRAIN_PREV_CACHE_MAX_ENTRIES`: Capacity of prev-signal data cache (`-1` = unlimited)

Station analyzer

- `STATION_ANALYZER_DISABLED`: Disable the station analyzer (`false`)
- `STATION_ANALYZER_QUEUE_MAX`: Max queued station tasks (`-1` = unlimited)

Route point analyzer

- `ROUTE_POINT_ANALYZER_DISABLED`: Disable the route point analyzer (`false`)
- `ROUTE_POINT_ANALYZER_ALLOWED_SERVERS`: Comma-separated whitelist of server codes (empty = all)
- `ROUTE_POINT_CLEANUP_INTERVAL_HOURS`: Hours before old route lines are removed (`48`)
- `ROUTE_POINT_MAX_BATCH_SIZE`: Batch size for DB inserts (`500`)
- `ROUTE_POINT_MAX_CONCURRENCY`: Parallelism for processing (`min(4, 2x CPU)`)
- `ROUTE_POINT_MIN_DISTANCE_METERS`: Min distance between points on a route (`100.0`)

Notes

- All `{SERVICE}_REFRESH_INTERVAL` values can be specified as "HH:MM:SS" or as integer seconds.
- When `DATABASE_URL` is not set, `ConnectionStrings:DefaultConnection` from appsettings is used.
- `FRONTEND_URL` augments the built-in localhost origins in development.

#### Database Migrations

The backend uses Entity Framework Core for database access. To apply migrations:

1. Make sure your database connection string is correctly configured
2. Run `dotnet ef database update` to apply all pending migrations

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes (please follow the formatting of the existing code, this project uses Prettier for frontend and standard C# formatting for backend)
4. Create a pull request

## License

![GitHub](https://img.shields.io/github/license/GNimrodG/simrail-map-optimized)

This project is licensed under the AGPL-3.0 license - see the [LICENSE](LICENSE) file for details

## Authors

- Nimród Glöckl - [gnimrodg](https://github.com/GNimrodG/)

## Acknowledgments

SMO is inspired by the SimRail railway simulator and aims to enhance the experience of players. Thanks to the SimRail community for their support and feedback.

Please note that this project is not officially affiliated with or endorsed by SimRail or its developers.
