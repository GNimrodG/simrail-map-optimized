import logger from "../logger";
import { Train } from "../api-helper";
import { extname } from "path";
import { Worker } from "worker_threads";

const workerPath = __dirname + "/signal-worker" + extname(__filename); // Use the same extension as this file, in dev it's .ts, in prod it's .js

logger.info(`Starting signal worker at ${workerPath}`, { module: "SIGNAL" });
const worker = new Worker(workerPath);

worker.on("error", (err) => {
  logger.error(`Worker error: ${err}`, { module: "SIGNAL" });
});

worker.on("exit", (code) => {
  if (code !== 0) {
    logger.error(`Worker stopped with exit code ${code}`, { module: "SIGNAL" });
  }
});

let SignalLocations = new Map<string, Signal>();
let TrainPreviousSignals = new Map<string, string>();

worker.on("message", (msg) => {
  SignalLocations = msg.SignalLocations || SignalLocations;
  TrainPreviousSignals = msg.TrainPreviousSignals || TrainPreviousSignals;
});

export function analyzeTrains(trains: Train[]) {
  worker.postMessage({ type: "analyze", data: trains });
}

export function setSignalType(id: string, type: string) {
  worker.postMessage({ type: "set-type", data: { id, type } });
}

export function getSignals() {
  return Array.from(SignalLocations.entries(), ([name, props]) => ({ name, ...props }));
}

export function getSignalsForTrains(trains: Train[]) {
  return Array.from(SignalLocations.entries(), ([name, props]) => {
    const signalFullName = name + "@" + props.extra;
    const train = trains.find((train) => train.TrainData.SignalInFront === signalFullName);
    return {
      ...props,
      name,
      train,
      trainAhead: trains.find((train) =>
        props.nextSignals.has(train.TrainData?.SignalInFront?.split("@")[0])
      ),
      prevSignals: Array.from(props.prevSignals),
      nextSignals: Array.from(props.nextSignals),
    };
  });
}

export interface Signal {
  lat: number;
  lon: number;
  extra: string;
  accuracy: number;
  type: string | null;
  prevSignals: Set<string>;
  nextSignals: Set<string>;
}
