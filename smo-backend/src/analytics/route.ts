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

const getRoutePointsPromises = new Map<string, (data: [number, number][]) => void>();

worker.on("message", (msg) => {
  switch (msg.type) {
    case "get-route-points": {
      logger.debug(`Got ${msg.data.points?.length} route points for ${msg.data.route}`, {
        module: "ROUTE",
      });
      const resolve = getRoutePointsPromises.get(msg.data.route);
      if (resolve) {
        resolve(msg.data.points);
        getRoutePointsPromises.delete(msg.data.route);
      }
      break;
    }
    default:
      logger.warn(`Unknown message type: ${msg.type}`, { module: "ROUTE" });
      break;
  }
});

export function analyzeTrainsForRoutes(trains: Train[]) {
  worker.postMessage({ type: "analyze-trains", data: trains });
}

export function getRoutePoints(trainRoute: string) {
  return new Promise<[number, number][]>((resolve) => {
    getRoutePointsPromises.set(trainRoute, resolve);
    worker.postMessage({ type: "get-route-points", data: trainRoute });
  });
}
