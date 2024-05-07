import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import logger from "../logger";
import { Train } from "../api-helper";
import { parentPort } from "worker_threads";
import { join } from "path";

logger.debug("Loading route worker...", { module: "ROUTE-WORKER" });

const RoutePoints = new Map<string, [number, number][]>();

const DATA_DIR = "data/routes-by-no";

try {
  logger.info("Loading routes...", { module: "ROUTE-WORKER" });
  readdirSync(DATA_DIR).forEach((file) => {
    logger.debug(`Loading ${file}...`, { module: "ROUTE-WORKER" });
    readFileSync(join(DATA_DIR, file), "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .forEach((line) => {
        const [route, lat, lon] = line.split(";");
        if (RoutePoints.has(route)) {
          RoutePoints.get(route)!.push([parseFloat(lat), parseFloat(lon)]);
        } else {
          RoutePoints.set(route, [[parseFloat(lat), parseFloat(lon)]]);
        }
      });
  });

  logger.info(
    `${RoutePoints.size} routes loaded with ${Array.from(RoutePoints.values()).reduce(
      (prev, curr) => prev + curr.length,
      0
    )} points`,
    { module: "ROUTE-WORKER" }
  );
} catch (e) {
  logger.warn(`No route file found (${e})`, { module: "ROUTE-WORKER" });
}

parentPort?.postMessage(RoutePoints);

const MIN_DISTANCE = 0.0001;

function analyzeTrainsForRoutes(trains: Train[]) {
  let addedPoints = 0;
  let discardedPoints = 0;

  for (const train of trains) {
    if (!train.TrainData.Latititute || !train.TrainData.Longitute) {
      logger.warn(
        `Train ${train.TrainNoLocal} (${train.TrainName}) on server ${train.ServerCode} has no location data!`,
        {
          module: "ROUTE-WORKER",
        }
      );
      continue;
    }

    const routeName = train.TrainNoLocal;
    const closestPoint = findDistanceToClosestPoint(
      routeName,
      train.TrainData.Latititute,
      train.TrainData.Longitute
    );

    if (closestPoint > MIN_DISTANCE) {
      if (RoutePoints.has(routeName)) {
        RoutePoints.get(routeName)!.push([train.TrainData.Latititute, train.TrainData.Longitute]);
      } else {
        RoutePoints.set(routeName, [[train.TrainData.Latititute, train.TrainData.Longitute]]);
      }
      addedPoints++;
    } else {
      discardedPoints++;
    }
  }

  logger.info(
    `Analyzed ${trains.length} trains, added ${addedPoints} points, discarded ${discardedPoints} points`,
    { module: "ROUTE-WORKER" }
  );

  if (++saveCounter > 10) {
    saveCounter = 0;
    saveRoutes();
  }
}

let saveCounter = 0;

function distance(point1: [number, number], point2: [number, number]) {
  return Math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2);
}

function findDistanceToClosestPoint(route: string, lat: number, lon: number): number {
  let closestDistance = Infinity;

  if (!RoutePoints.has(route)) {
    return Infinity;
  }

  for (const [pointLat, pointLon] of RoutePoints.get(route)!) {
    const dist = distance([lat, lon], [pointLat, pointLon]);
    if (dist < closestDistance) {
      closestDistance = dist;
    }
  }

  return closestDistance;
}

function saveRoutes() {
  logger.info("Saving routes...", { module: "ROUTE-WORKER" });
  const start = Date.now();

  parentPort?.postMessage(RoutePoints);

  const data = Array.from(RoutePoints).map(([route, points]) => ({
    route,
    points: points.map(([lat, lon]) => `${route};${lat};${lon}`),
  }));

  mkdirSync(DATA_DIR, { recursive: true });

  data.forEach(({ route, points }) =>
    writeFileSync(join(DATA_DIR, `${route}.csv`), points.join("\n"))
  );

  logger.info(`${data.length} routes saved in ${Date.now() - start}ms`, {
    module: "ROUTE-WORKER",
    level: "success",
  });

  if (Date.now() - start > 1000) {
    logger.warn("Saving routes took longer than 1s", { module: "ROUTE-WORKER" });
  }
}

parentPort?.on("message", analyzeTrainsForRoutes);

logger.info("Route worker started", { module: "ROUTE-WORKER" });
