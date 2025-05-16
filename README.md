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

#### Required Environment Variables

The application uses the following environment variables:

- `DATABASE_URL` or `ConnectionStrings:DefaultConnection`: PostgreSQL connection string with PostGIS extension
- `STEAM_API_KEY`: Optional Steam API key for player stats
- `ADMIN_PASSWORD`: Password for administrative API endpoints
- `FRONTEND_URL`: URL of the frontend for CORS configuration (defaults to https://smo.data-unknown.com and http://localhost:5173 for local development)

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
