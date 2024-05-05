import { Train } from "../api-helper";
import logger from "../logger";
import { extname } from "path";
import { Worker } from "worker_threads";

const workerPath = __dirname + ("/signal-worker" + extname(__filename)); // Use the same extension as this file, in dev it's .ts, in prod it's .js

const worker = new Worker(workerPath);

let SignalLocations = new Map<
  string,
  { lat: number; lon: number; extra: string; accuracy: number }
>();

worker.on("message", (msg) => {
  SignalLocations = msg;
  logger.info(`${SignalLocations.size} signals loaded`, { module: "SIGNALS" });
});

export function analyzeTrains(trains: Train[]) {
  worker.postMessage(trains);
}

export function getSignals() {
  return Array.from(SignalLocations.entries(), ([name, { lat, lon, extra, accuracy }]) => ({
    name,
    lat,
    lon,
    extra,
    accuracy,
  }));
}

export function getSignalsForTrains(trains: Train[]) {
  return getSignals().map((signal) => {
    const signalFullName = signal.name + "@" + signal.extra;
    const train = trains.find((train) => train.TrainData.SignalInFront === signalFullName);
    return { ...signal, train };
  });
}
