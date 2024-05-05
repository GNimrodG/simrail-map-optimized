import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import logger from "../logger";
import { Train } from "../api-helper";
import { parentPort } from "worker_threads";

const RoutePoints = new Map<string, [number, number][]>();

try {
  logger.info("Loading routes...", { module: "ROUTE-WORKER" });
  readdirSync("data/routes").forEach((file) => {
    readFileSync("data/routes/" + file, "utf-8")
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

const MIN_DISTANCE = 0.00001;

function analyzeTrainsForRoutes(trains: Train[]) {
  for (const train of trains) {
    if (!train.TrainData.Latititute || !train.TrainData.Longitute) {
      logger.warn(
        `Train ${train.TrainNoLocal} (${train.TrainName}) on server ${train.ServerCode} has no location data!`,
        {
          module: "ROUTE",
        }
      );
      continue;
    }
    const routeName = train.StartStation + "-" + train.EndStation;
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
    }
  }

  for (const [route, points] of RoutePoints.entries()) {
    let newPoints: [number, number][] = points.toSorted((a, b) => distance(a, b));

    for (let i = 0; i < newPoints.length - 1; i++) {
      for (let j = i + 1; j < newPoints.length; j++) {
        if (distance(newPoints[i], newPoints[j]) < MIN_DISTANCE) {
          newPoints.splice(j, 1);
          j--;
        }
      }
    }

    if (newPoints.length !== points.length) {
      logger.info(
        `Removed ${points.length - newPoints.length} duplicate points from route ${route}`,
        {
          module: "ROUTE",
        }
      );
      RoutePoints.set(route, newPoints);
    }

    if (newPoints.length === 0) {
      RoutePoints.delete(route);
    }
  }

  saveRoutes();
}

function distance(point1: [number, number], point2: [number, number]) {
  return Math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2);
}

function findDistanceToClosestPoint(route: string, lat: number, lon: number): number {
  let closestDistance = Infinity;

  if (!RoutePoints.has(route)) {
    return Infinity;
  }

  for (const [pointLat, pointLon] of RoutePoints.get(route)!) {
    const distance = Math.sqrt((pointLat - lat) ** 2 + (pointLon - lon) ** 2);
    if (distance < closestDistance) {
      closestDistance = distance;
    }
  }

  return closestDistance;
}

function saveRoutes() {
  logger.info("Saving routes...", { module: "ROUTE" });
  const start = Date.now();
  const data = Array.from(RoutePoints).map(([route, points]) => ({
    route,
    points: points.map(([lat, lon]) => `${route};${lat};${lon}`),
  }));

  mkdirSync("data/routes", { recursive: true });

  data.forEach(({ route, points }) => writeFileSync(`data/routes/${route}.csv`, points.join("\n")));

  logger.info(`${data.length} routes saved in ${Date.now() - start}ms`, {
    module: "ROUTE",
    level: "success",
  });

  if (Date.now() - start > 1000) {
    logger.warn("Saving routes took longer than 1s", { module: "ROUTE" });
  }
}

parentPort?.on("message", analyzeTrainsForRoutes);
