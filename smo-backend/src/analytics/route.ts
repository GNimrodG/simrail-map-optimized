import logger from "../logger";
import { Train } from "../api-helper";
import { extname } from "path";
import { Worker } from "worker_threads";

const workerPath = __dirname + "/route-worker" + extname(__filename); // Use the same extension as this file, in dev it's .ts, in prod it's .js

logger.info(`Starting route worker at ${workerPath}`, { module: "ROUTE" });
const worker = new Worker(workerPath);
logger.info(`Route worker started`, { module: "ROUTE" });

worker.on("error", (err) => {
  logger.error(`Worker error: ${err}`, { module: "ROUTE" });
});

worker.on("exit", (code) => {
  if (code !== 0) {
    logger.error(`Worker stopped with exit code ${code}`, { module: "ROUTE" });
  }
});

let RoutePoints = new Map<string, [number, number][]>();

worker.on("message", (msg) => {
  RoutePoints = msg;
});

export function analyzeTrainsForRoutes(trains: Train[]) {
  worker.postMessage(trains);
}

export function getRoutePoints(trainRoute: string) {
  return RoutePoints.get(trainRoute) || [];
}
