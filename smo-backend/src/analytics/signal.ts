import { ModuleLogger } from "../logger";
import { Train, getBaseTrain } from "../api-helper";
import { extname } from "path";
import { Worker } from "worker_threads";
import { prisma } from "../db";

const workerPath = __dirname + "/signal-worker" + extname(__filename); // Use the same extension as this file, in dev it's .ts, in prod it's .js

const logger = new ModuleLogger("SIGNAL-PROC");

logger.info(`Starting signal worker at ${workerPath}`);
const worker = new Worker(workerPath);

worker.on("error", (err) => {
  logger.error(`Worker error: ${err}`);
});

worker.on("exit", (code) => {
  if (code !== 0) {
    logger.error(`Worker stopped with exit code ${code}`);
  }
});

export function analyzeTrains(trains: Train[]) {
  worker.postMessage({ type: "analyze", data: trains });
}

export async function setSignalType(id: string, type: string) {
  const result = await prisma.$executeRaw`
          UPDATE signals
          SET type = ${type}
          WHERE name = ${id}
        `;

  if (!result) {
    logger.error(`Failed to set signal ${id} type to ${type}, the signal may not exist.`);
    return false;
  }

  logger.success(`Signal ${id} type set to ${type}`);
  return true;
}

export async function removeSignalPrevSignal(signalId: string, prevSignal: string) {
  const result = await prisma.$executeRaw`
          DELETE FROM prev_signals
          WHERE signal = ${signalId} AND prev_signal = ${prevSignal}
        `;

  if (!result) {
    logger.error(
      `Failed to remove signal connection ${prevSignal}->[${signalId}], the signal may not exist.`
    );
    return false;
  }

  logger.success(`Signal connection ${prevSignal}->[${signalId}] removed`);
  return true;
}

export async function removeSignalNextSignal(signal: string, nextSignal: string) {
  const result = await prisma.$executeRaw`
    DELETE FROM next_signals
    WHERE signal = ${signal} AND next_signal = ${nextSignal}
  `;

  if (!result) {
    logger.error(
      `Failed to remove signal connection [${signal}]->${nextSignal}, the signal may not exist.`
    );
    return false;
  }

  logger.success(`Signal connection [${signal}]->${nextSignal} removed`);
  return true;
}

export async function addSignalPrevSignal(signal: string, prevSignal: string) {
  const result = await prisma.$executeRaw`
    INSERT INTO prev_signals (signal, prev_signal)
    VALUES (${signal}, ${prevSignal})
  `;

  if (!result) {
    logger.error(
      `Failed to add signal connection ${prevSignal}->[${signal}], the signal may not exist.`
    );
    return false;
  }

  logger.success(`Signal connection ${prevSignal}->[${signal}] added`);
  return true;
}

export async function addSignalNextSignal(signal: string, nextSignal: string) {
  const result = await prisma.$executeRaw`
    INSERT INTO next_signals (signal, next_signal)
    VALUES (${signal}, ${nextSignal})
  `;

  if (!result) {
    logger.error(
      `Failed to add signal connection [${signal}]->${nextSignal}, the signal may not exist.`
    );
    return false;
  }

  logger.success(`Signal connection [${signal}]->${nextSignal} added`);
  return true;
}

export async function getSignals() {
  const rawSignals = await prisma.$queryRaw<RawSignal[]>`
  SELECT signals.name,
    ST_X(signals.point) as lat,
    ST_Y(signals.point) as lon,
    extra,
    accuracy,
    type,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT prev_signals.prev_signal), ',') as prevsignals,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT next_signals.next_signal), ',') as nextsignals
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
      prevSignals: rawSignal.prevsignals?.trim().split(",").filter(Boolean) || [],
      nextSignals: rawSignal.nextsignals?.trim().split(",").filter(Boolean) || [],
    };
  });
}

export async function getSignal(id: string) {
  const [rawSignal] = await prisma.$queryRaw<RawSignal[]>`
  SELECT signals.name,
    ST_X(signals.point) as lat,
    ST_Y(signals.point) as lon,
    extra,
    accuracy,
    type,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT prev_signals.prev_signal), ',') as prevsignals,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT next_signals.next_signal), ',') as nextsignals
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
    prevSignals: rawSignal.prevsignals?.trim().split(",").filter(Boolean) || [],
    nextSignals: rawSignal.nextsignals?.trim().split(",").filter(Boolean) || [],
  };
}

export async function checkSignalExists(id: string) {
  const signal = await prisma.signals.findUnique({ where: { name: id }, select: { name: true } });
  return !!signal;
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
