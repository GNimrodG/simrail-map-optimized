import { ModuleLogger } from "../logger";
import { Train } from "../api-helper";
import { extname } from "path";
import { Worker } from "worker_threads";
import { prisma } from "../db";

const workerPath = __dirname + "/route-worker" + extname(__filename); // Use the same extension as this file, in dev it's .ts, in prod it's .js
const logger = new ModuleLogger("ROUTE-PROC");

logger.info(`Starting route worker at ${workerPath}`);
let worker = new Worker(workerPath);
logger.info(`Route worker started`);

worker.on("error", (err) => {
  logger.error(`Worker error: ${err}`);
});

worker.on("exit", (code) => {
  if (code !== 0) {
    logger.error(`Worker stopped with exit code ${code}`);

    logger.info(`Starting new worker`);
    worker = new Worker(workerPath);
    logger.info(`New worker started`);
  }
});

export function analyzeTrainsForRoutes(trains: Train[]) {
  worker.postMessage({ type: "analyze-trains", data: trains });
}

export async function getRoutePoints(routeId: string): Promise<[number, number][]> {
  const data =
    await prisma.$queryRaw`SELECT ST_X(point) as lat, ST_Y(point) as lon FROM routepoints WHERE route_id = ${routeId}`;
  if (!data || !Array.isArray(data)) {
    return [];
  }

  return data.map((point) => [point.lat, point.lon]);
}
