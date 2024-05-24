import logger from "../logger";
import { Train, getBaseTrain } from "../api-helper";
import { extname } from "path";
import { Worker } from "worker_threads";
import { prisma } from "../db";

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

let TrainPreviousSignals = new Map<string, string>();

worker.on("message", (msg) => {
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

export async function getSignals() {
  const rawSignals = await prisma.$queryRaw<RawSignal[]>`
  SELECT signals.name,
    ST_X(signals.point) as lat,
    ST_Y(signals.point) as lon,
    extra,
    accuracy,
    type,
    ARRAY_TO_STRING(ARRAY_AGG(prev_signals.prev_signal), ',') as prevsignals,
    ARRAY_TO_STRING(ARRAY_AGG(next_signals.next_signal), ',') as nextsignals
  FROM signals
    LEFT JOIN prev_signals ON signals.name = prev_signals.signal
    LEFT JOIN next_signals ON signals.name = next_signals.signal
  GROUP BY signals.name
    `;

  return rawSignals.map((rawSignal) => {
    return {
      ...rawSignal,
      prevsignals: undefined,
      nextsignals: undefined,
      prevSignals: rawSignal.prevsignals?.trim().split(",") || [],
      nextSignals: rawSignal.nextsignals?.trim().split(",") || [],
    };
  });
}

export async function getSignal(id: string) {
  const rawSignal = await prisma.$queryRaw<RawSignal>`
  SELECT signals.name,
    ST_X(signals.point) as lat,
    ST_Y(signals.point) as lon,
    extra,
    accuracy,
    type,
    ARRAY_TO_STRING(ARRAY_AGG(prev_signals.prev_signal), ',') as prevsignals,
    ARRAY_TO_STRING(ARRAY_AGG(next_signals.next_signal), ',') as nextsignals
  FROM signals
    LEFT JOIN prev_signals ON signals.name = prev_signals.signal
    LEFT JOIN next_signals ON signals.name = next_signals.signal
  WHERE signals.name = ${id}
  GROUP BY signals.name
    `;

  return {
    ...rawSignal,
    prevsignals: undefined,
    nextsignals: undefined,
    prevSignals: rawSignal.prevsignals?.trim().split(",") || [],
    nextSignals: rawSignal.nextsignals?.trim().split(",") || [],
  };
}

export async function getSignalsForTrains(trains: Train[]) {
  const signalsIndex = new Map<string, Train>();

  trains.forEach((train) => {
    if (train.TrainData?.SignalInFront) {
      signalsIndex.set(train.TrainData.SignalInFront.split("@")[0], train);
    }
  });

  return await getSignals().then((signals) =>
    Promise.all(
      signals.map(async (signal) => {
        const train = signalsIndex.get(signal.name);

        const trainAhead =
          signal.type === "block"
            ? signalsIndex.get(
                signal.nextSignals.find((nextSignal) => signalsIndex.has(nextSignal)) || ""
              )
            : null;

        const nextSignalWithTrainAhead =
          (signal.type === "block" &&
            signal.nextSignals.find((nextSignal) => {
              const nextSignalData = signals.find((s) => s.name === nextSignal);
              if (!nextSignalData) {
                return false;
              }

              return nextSignalData.nextSignals.some((nextNextSignal) =>
                signalsIndex.get(nextNextSignal)
              );
            })) ||
          null;

        return {
          ...signal,
          train: getBaseTrain(train),
          trainAhead: getBaseTrain(trainAhead),
          nextSignalWithTrainAhead,
        };
      })
    )
  );
}

interface RawSignal {
  name: string;
  lat: number;
  lon: number;
  extra: string;
  accuracy: number;
  type: string | null;
  prevsignals: string;
  nextsignals: string;
}

export interface Signal {
  name: string;
  lat: number;
  lon: number;
  extra: string;
  accuracy: number;
  type: string | null;
  prevSignals: Array<string>;
  nextSignals: Array<string>;
}
