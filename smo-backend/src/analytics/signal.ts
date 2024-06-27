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

export async function updateSignal(
  id: string,
  data: {
    type: string | null;
    role: string | null;
    prevFinalized?: boolean | null;
    nextFinalized?: boolean | null;
  }
) {
  const result = await prisma.$executeRaw`
          UPDATE signals
          SET
            type = COALESCE(${data.type}, type),
            role = COALESCE(${data.role}, role),
            prev_finalized = COALESCE(${data.prevFinalized}, prev_finalized),
            next_finalized = COALESCE(${data.nextFinalized}, next_finalized)
          WHERE name = ${id}
        `;

  if (!result) {
    logger.error(`Failed to update signal ${id}`);
    return false;
  }

  logger.success(`Signal ${id} updated`);
  return true;
}

export async function deleteSignal(id: string) {
  const result = await prisma.$executeRaw`
    DELETE FROM signals
    WHERE name = ${id}
  `;

  if (!result) {
    logger.error(`Failed to delete signal ${id}`);
    return false;
  }

  logger.success(`Signal ${id} deleted`);
  return true;
}

export async function removeSignalPrevSignal(signal: string, prevSignal: string) {
  const result = await prisma.signalConnections.delete({
    where: {
      prev_next: {
        prev: prevSignal,
        next: signal,
      },
    },
  });

  if (!result) {
    logger.error(
      `Failed to remove signal connection ${prevSignal}->${signal}, the signal may not exist.`
    );
    return false;
  }

  logger.success(`Signal connection ${prevSignal}->${signal} removed`);
  return true;
}

export async function removeSignalNextSignal(signal: string, nextSignal: string) {
  const result = await prisma.signalConnections.delete({
    where: {
      prev_next: {
        prev: signal,
        next: nextSignal,
      },
    },
  });

  if (!result) {
    logger.error(
      `Failed to remove signal connection ${signal}->${nextSignal}, the signal may not exist.`
    );
    return false;
  }

  logger.success(`Signal connection ${signal}->${nextSignal} removed`);
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

export async function getTrainPreviousSignal() {
  return new Promise<Record<string, string>>((resolve, reject) => {
    worker.once("message", (message) => {
      if (message.type === "train-previous-signal") {
        resolve(message.data);
      } else {
        reject(new Error(`Unknown message type: ${message.type}`));
      }
    });

    worker.postMessage({ type: "get-train-previous-signal" });
  });
}

export async function getSignals() {
  const rawSignals = await prisma.$queryRaw<RawSignal[]>`
  SELECT signals.name,
    ST_X(signals.point) as lon,
    ST_Y(signals.point) as lat,
    extra,
    accuracy,
    type,
    role,
    prev_finalized,
    next_finalized,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT p.prev), ',') as prevsignals,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT n.next), ',') as nextsignals
  FROM signals
    LEFT JOIN signal_connections p ON signals.name = p.next
    LEFT JOIN signal_connections n ON signals.name = n.prev
  GROUP BY signals.name
    `;

  return rawSignals.map((rawSignal) => {
    return {
      name: rawSignal.name,
      lat: rawSignal.lat,
      lon: rawSignal.lon,
      extra: rawSignal.extra,
      accuracy: rawSignal.accuracy,
      type: rawSignal.type,
      role: rawSignal.role,
      prevFinalized: rawSignal.prev_finalized,
      nextFinalized: rawSignal.next_finalized,
      prevSignals: rawSignal.prevsignals?.trim().split(",").filter(Boolean) || [],
      nextSignals: rawSignal.nextsignals?.trim().split(",").filter(Boolean) || [],
    };
  });
}

export async function getSignal(id: string) {
  const [rawSignal] = await prisma.$queryRaw<RawSignal[]>`
  SELECT signals.name,
    ST_X(signals.point) as lon,
    ST_Y(signals.point) as lat,
    extra,
    accuracy,
    type,
    role,
    prev_finalized,
    next_finalized,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT p.prev), ',') as prevsignals,
    ARRAY_TO_STRING(ARRAY_AGG(DISTINCT n.next), ',') as nextsignals
  FROM signals
    LEFT JOIN signal_connections p ON signals.name = p.next
    LEFT JOIN signal_connections n ON signals.name = n.prev
  WHERE signals.name = ${id}
  GROUP BY signals.name
    `;

  return {
    name: rawSignal.name,
    lat: rawSignal.lat,
    lon: rawSignal.lon,
    extra: rawSignal.extra,
    accuracy: rawSignal.accuracy,
    type: rawSignal.type,
    role: rawSignal.role,
    prevFinalized: rawSignal.prev_finalized,
    nextFinalized: rawSignal.next_finalized,
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

  const signals = await getSignals();

  const result = await Promise.all(
    signals.map(async (signal) => {
      const train = signalsIndex.get(signal.name);

      const trainAhead =
        (signal.type === "block" &&
          signal.nextSignals.length === 1 &&
          signalsIndex.get(signal.nextSignals[0])) ||
        null;

      let nextSignalWithTrainAhead = null;

      if (signal.type === "block" && signal.nextSignals.length === 1) {
        const nextSignal = signals.find((s) => s.name === signal.nextSignals[0]);

        if (nextSignal && nextSignal.nextSignals.length === 1) {
          const nextNextSignal = signals.find((s) => s.name === nextSignal.nextSignals[0]);

          if (nextNextSignal && signalsIndex.get(nextNextSignal.name)) {
            nextSignalWithTrainAhead = signal.nextSignals[0];
          }
        }
      }

      return {
        ...signal,
        train: getBaseTrain(train),
        trainAhead: getBaseTrain(trainAhead),
        nextSignalWithTrainAhead,
      };
    })
  );

  return result;
}

interface RawSignal {
  name: string;
  lat: number;
  lon: number;
  extra: string;
  accuracy: number;
  type: string | null;
  role: string | null;
  prev_finalized: boolean;
  next_finalized: boolean;
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
  role: string | null;
  prevFinalized: boolean;
  nextFinalized: boolean;
  prevSignals: Array<string>;
  nextSignals: Array<string>;
}
