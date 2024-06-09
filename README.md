# Simrail Map Optimalized (SMO)

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
2. Run `yarn install` to install the dependencies
3. Copy .env.sample to .env and fill in the required environment variables
4. Run `yarn dev` to start the development server
5. The backend server will be running on `http://localhost:3000/`

## Contributing

1. Fork the repository
2. Create a new branch
3. Make your changes (please follow the formatting of the existing code, this project uses Prettier)
4. Create a pull request

## License

![GitHub](https://img.shields.io/github/license/GNimrodG/simrail-map-optimized)

This project is licensed under the AGPL-3.0 license - see the [LICENSE](LICENSE) file for details

## Authors

- Nimród Glöckl - [gnimrodg](https://github.com/GNimrodG/)

## Acknowledgments

SMO is inspired by the SimRail railway simulator and aims to enhance the experience of players. Thanks to the SimRail community for their support and feedback.

Please note that this project is not officially affiliated with or endorsed by SimRail or its developers.
