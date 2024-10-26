import { extname } from "path";
import { ModuleLogger } from "../logger";
import { Worker } from "worker_threads";
import { Train } from "../api-helper";

const workerPath = __dirname + "/train-trails-worker" + extname(__filename); // Use the same extension as this file, in dev it's .ts, in prod it's .js

const logger = new ModuleLogger("TRAIN-TRAILS");

logger.info(`Starting train trails worker at ${workerPath}`);
const worker = new Worker(workerPath);

worker.on("error", (err) => {
  logger.error(`Worker error: ${err}`);
});

worker.on("exit", (code) => {
  if (code !== 0) {
    logger.error(`Worker stopped with exit code ${code}`);
  }
});

export function analyzeTrainsForTrail(trains: Train[]) {
  worker.postMessage({ type: "analyze", data: trains });
}
