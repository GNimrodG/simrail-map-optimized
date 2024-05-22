import { Train } from "../api-helper";
import { parentPort } from "worker_threads";
import { ModuleLogger } from "../logger";
import { prisma } from "../db";

const logger = new ModuleLogger("ROUTE-WORKER");
logger.debug("Loading route worker...");

async function getRoutePoints(routeId: string): Promise<[number, number][]> {
  const data =
    await prisma.$queryRaw`SELECT ST_X(point) as lat, ST_Y(point) as lon FROM routepoints WHERE route_id = ${routeId}`;
  if (!data || !Array.isArray(data)) {
    return [];
  }

  return data.map((point) => [point.lat, point.lon]);
}

let routePointQueue: { route: string; point: [number, number] }[] = [];
let routePointQueueTimeout: NodeJS.Timeout | null = null;

async function addRoutePoint(route: string, point: [number, number]) {
  routePointQueue.push({ route, point });

  if (routePointQueueTimeout) {
    clearTimeout(routePointQueueTimeout);
  }

  routePointQueueTimeout = setTimeout(async () => {
    const points = routePointQueue;
    routePointQueue = [];
    routePointQueueTimeout = null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO routepoints (route_id, point) VALUES ${points.map(
        ({ route, point }) => `(${route}, 'SRID=4326;POINT(${point[0]} ${point[1]})'::geometry)`
      )}`
    );
  }, 500);
}

const MIN_DISTANCE = process.env.ROUTE_MIN_DISTANCE
  ? parseInt(process.env.ROUTE_MIN_DISTANCE)
  : 200;

let processing = false;

async function analyzeTrainsForRoutes(trains: Train[]) {
  if (processing) {
    logger.warn("Already processing trains, skipping...");
    return;
  }

  processing = true;
  try {
    const start = Date.now();
    let addedPoints = 0;
    let discardedPoints = 0;
    let distances: number[] = [];

    for (const train of trains) {
      if (!train.TrainData.Latititute || !train.TrainData.Longitute) {
        logger.warn(
          `Train ${train.TrainNoLocal} (${train.TrainName}) on server ${train.ServerCode} has no location data!`
        );
        continue;
      }

      const closestPoint = await findDistanceToClosestPoint(
        train.TrainNoLocal,
        train.TrainData.Latititute,
        train.TrainData.Longitute
      );

      distances.push(closestPoint);

      if (closestPoint > MIN_DISTANCE) {
        addRoutePoint(train.TrainNoLocal, [train.TrainData.Latititute, train.TrainData.Longitute]);
        addedPoints++;
      } else {
        discardedPoints++;
      }
    }

    logger.info(
      `Analyzed ${trains.length} trains in ${
        Date.now() - start
      }ms, added ${addedPoints} points, discarded ${discardedPoints} points`
    );

    if (distances.length) {
      logger.debug(
        `Average distance to closest point: ${
          distances.reduce((a, b) => a + b, 0) / distances.length
        }; max: ${Math.max(...distances)}; min: ${Math.min(...distances)}; total: ${
          distances.length
        }`
      );
    }
  } catch (e) {
    logger.error(`Error analyzing trains: ${e}`);
  } finally {
    processing = false;
  }
}

async function findDistanceToClosestPoint(routeId: string, lat: number, lon: number) {
  // using raw query get the nearest point to the given lat and lon from postgis
  const data = await prisma.$queryRaw`
    SELECT 
      ST_DistanceSphere(
        ${`SRID=4326;POINT(${lat} ${lon})`}::geometry,
        point
      ) as distance
    FROM routepoints
    WHERE route_id = ${routeId}
    ORDER BY distance
    LIMIT 1
  `;

  if (!data || !Array.isArray(data) || data.length === 0) {
    return Infinity;
  }

  return data[0].distance;
}

parentPort?.on("message", async (msg) => {
  switch (msg.type) {
    case "analyze-trains":
      await analyzeTrainsForRoutes(msg.data);
      break;
    case "get-route-points": {
      const points = await getRoutePoints(msg.data);
      parentPort?.postMessage({
        type: "get-route-points",
        data: { route: msg.data, points },
      });
      break;
    }
    default:
      logger.warn(`Unknown message type: ${msg.type}`);
  }
});

logger.info("Route worker started");
