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

export function removeSignalPrevSignal(signal: string, prevSignal: string) {
  worker.postMessage({ type: "remove-prev-signal", data: { signal, prevSignal } });
}

export function removeSignalNextSignal(signal: string, nextSignal: string) {
  worker.postMessage({ type: "remove-next-signal", data: { signal, nextSignal } });
}

export function addSignalPrevSignal(signal: string, prevSignal: string) {
  worker.postMessage({ type: "add-prev-signal", data: { signal, prevSignal } });
}

export function addSignalNextSignal(signal: string, nextSignal: string) {
  worker.postMessage({ type: "add-next-signal", data: { signal, nextSignal } });
}

export function getSignals() {
  return Array.from(SignalLocations.entries(), ([name, props]) => ({ name, ...props }));
}

export function getSignalsForTrains(trains: Train[]) {
  const signalsIndex = new Map<string, Train>();

  trains.forEach((train) => {
    const signalInFront = train.TrainData.SignalInFront;
    if (train.TrainData.SignalInFront) {
      signalsIndex.set(signalInFront.split("@")[0], train);
    }
  });

  return Array.from(SignalLocations.entries(), ([name, props]) => {
    const train = signalsIndex.get(name);

    const trainAhead =
      props.type === "block"
        ? signalsIndex.get(
            Array.from(props.nextSignals).find((nextSignal) => signalsIndex.has(nextSignal)) || ""
          )
        : null;

    const nextSignalWithTrainAhead =
      (props.type === "block" &&
        Array.from(props.nextSignals).find((nextSignal) => {
          const nextSignalData = SignalLocations.get(nextSignal);
          if (!nextSignalData) {
            return false;
          }

          return Array.from(nextSignalData.nextSignals).some((nextNextSignal) =>
            signalsIndex.get(nextNextSignal)
          );
        })) ||
      null;

    return {
      ...props,
      name,
      train,
      trainAhead,
      nextSignalWithTrainAhead,
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
