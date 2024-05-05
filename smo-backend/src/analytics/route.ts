import logger from "../logger";
import { Train } from "../api-helper";
import { Worker } from "worker_threads";
import { extname } from "path";

const workerPath = __dirname + ("/route-worker" + extname(__filename)); // Use the same extension as this file, in dev it's .ts, in prod it's .js
const worker = new Worker(workerPath);

let RoutePoints = new Map<string, [number, number][]>();

worker.on("message", (msg) => {
  RoutePoints = msg;
  logger.info(
    `${RoutePoints.size} routes loaded with ${Array.from(RoutePoints.values()).reduce(
      (prev, curr) => prev + curr.length,
      0
    )} points`,
    { module: "SIGNALS" }
  );
});

export function analyzeTrainsForRoutes(trains: Train[]) {
  worker.postMessage(trains);
}

worker.on("error", (err) => {
  logger.error(err.message, { module: "ROUTE-WORKER" });
});

worker.on("exit", (code) => {
  if (code !== 0) {
    logger.error(`Worker stopped with exit code ${code}`, { module: "ROUTE-WORKER" });
  }
});

export function getRoutePoints(trainRoute: string) {
  return RoutePoints.get(trainRoute) || [];
}
