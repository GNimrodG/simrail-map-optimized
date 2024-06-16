import { readFileSync, renameSync, statSync } from "fs";
import type { Train } from "../api-helper";
import { parentPort } from "worker_threads";
import { ModuleLogger } from "../logger";
import { prisma } from "../db";
import { LRUCache } from "lru-cache";
import {
  BLOCK_SIGNAL_REGEX,
  BLOCK_SIGNAL_REVERSE_REGEX,
  getSignalRole,
  getSignalType,
  loadFileLinesToDatabase,
  tryLogError,
} from "./signal-utils";

const logger = new ModuleLogger("SIGNALS-PROC-WORKER");

const TrainPreviousSignals = new LRUCache<string, string>({
  ttl: 1000 * 60 * 60, // 1 hour
  ttlAutopurge: true,
  updateAgeOnGet: true,
});

try {
  statSync("data/signals.csv");
  logger.info("Loading signals...");
  loadFileLinesToDatabase(readFileSync("data/signals.csv", "utf-8").split("\n")).then();

  renameSync("data/signals.csv", `data/signals-${Date.now()}.csv`);

  logger.info(`Signals loaded from file to the database`);

  if (statSync("data/signals-old.csv")?.isFile()) {
    logger.info("Merging old signal data...");

    loadFileLinesToDatabase(readFileSync("data/signals-old.csv", "utf-8").split("\n")).then();

    renameSync("data/signals-old.csv", `data/signals-old-merged-${Date.now()}.csv`);
  }
} catch (e) {
  logger.warn(`No signals file found (${e})`);
}

let running = false;

async function analyzeTrains(trains: Train[]) {
  if (running) {
    logger.warn("Already running, skipping...");
    return;
  }

  running = true;

  try {
    const start = Date.now();
    const signals = await prisma.signals.findMany({
      where: {
        name: {
          in: [
            ...trains.map((train) => train?.TrainData?.SignalInFront?.split("@")[0]),
            ...TrainPreviousSignals.values(),
          ].filter((x, i, a) => !!x && a.indexOf(x) === i),
        },
      },
      select: {
        name: true,
        accuracy: true,
        type: true,
        role: true,
        prev_finalized: true,
        next_finalized: true,
        prevSignalConnections: { select: { next: true } },
        nextSignalConnections: { select: { prev: true } },
      },
    });

    for (const train of trains) {
      if (!train.TrainData.Latititute || !train.TrainData.Longitute) {
        logger.warn(
          `Train ${train.TrainNoLocal}@${train.ServerCode} (${train.Type}) has no location data!`
        );
        continue;
      }

      if (!train.TrainData.SignalInFront) {
        continue;
      }

      const trainId = `${train.id}@${train.ServerCode}-${train.TrainNoLocal}`;
      const [signalId, extra] = train.TrainData.SignalInFront.split("@");
      let signal = signals.find((signal) => signal.name === signalId);
      const type = getSignalType(train);
      const role = signal ? getSignalRole(signal) : null;

      // check if signal type should be updated
      if (!!signal && !signal.type && !!type) {
        try {
          await prisma.signals.update({
            where: { name: signalId },
            data: {
              type: type,
            },
          });
          if (type === "main") {
            logger.success(
              `Signal ${signalId} type set to ${type} because of it's VMAX: ${train.TrainData.SignalInFrontSpeed} km/h`
            );
          } else {
            logger.success(`Signal ${signalId} type set to ${type} because of it's name.`);
          }
        } catch (e) {
          logger.error(`Failed to set signal ${signalId} type to ${type}: ${e}`);
        }
      }

      // check if signal accuracy could be updated
      if (train.TrainData.DistanceToSignalInFront < 5) {
        if (signal) {
          // signal already exists
          if (signal.accuracy > train.TrainData.DistanceToSignalInFront) {
            // accuracy improved
            try {
              await prisma.$executeRaw`
                UPDATE signals
                SET
                  accuracy = ${train.TrainData.DistanceToSignalInFront},
                  point = ${`SRID=4326;POINT(${train.TrainData.Latititute} ${train.TrainData.Longitute})`}
                WHERE name = ${signalId}`;
              logger.success(
                `Signal ${signalId} accuracy updated from ${signal.accuracy}m to ${
                  train.TrainData.DistanceToSignalInFront
                }m (${signal.accuracy - train.TrainData.DistanceToSignalInFront}m)`
              );
            } catch (e) {
              logger.error(
                `Failed to update signal ${signalId} accuracy to ${train.TrainData.DistanceToSignalInFront}m: ${e}`
              );
            }
          }
        } else {
          // new signal
          try {
            await prisma.$executeRaw`
              INSERT INTO signals (name, point, extra, accuracy, type)
              VALUES (${signalId}, ${`SRID=4326;POINT(${train.TrainData.Latititute} ${train.TrainData.Longitute})`}, ${extra}, ${
              train.TrainData.DistanceToSignalInFront
            }, ${type})`;

            signal = {
              name: signalId,
              accuracy: train.TrainData.DistanceToSignalInFront,
              type: type,
              role: null,
              prev_finalized: false,
              next_finalized: false,
              prevSignalConnections: [],
              nextSignalConnections: [],
            };
            signals.push(signal);

            logger.success(
              `New signal detected: ${signalId} at ${train.TrainData.Latititute}, ${train.TrainData.Longitute} (${extra}) with accuracy ${train.TrainData.DistanceToSignalInFront}m`
            );
          } catch (e) {
            logger.error(`Failed to create new signal ${signalId}: ${e}`);
          }
        }
      }

      // check if role could be updated
      if (signal && !signal.role && role) {
        try {
          await prisma.signals.update({
            where: { name: signalId },
            data: {
              role: role,
            },
          });
          logger.success(`Signal ${signalId} role set to ${role}`);
        } catch (e) {
          logger.error(`Failed to set signal ${signalId} role to ${role}: ${e}`);
        }
      }

      const prevSignalId = TrainPreviousSignals.get(trainId);

      if (prevSignalId && prevSignalId !== signalId && !signal?.prev_finalized) {
        // train reached a new signal from a previous signal
        const prevSignal =
          signals.find((signal) => signal.name === prevSignalId) ||
          (await prisma.signals.findUnique({
            where: { name: prevSignalId },
            select: {
              name: true,
              type: true,
              role: true,
              prev_finalized: true,
              next_finalized: true,
              prevSignalConnections: { select: { next: true } },
              nextSignalConnections: { select: { prev: true } },
            },
          }));

        if (!prevSignal) {
          logger.warn(
            `Train ${train.TrainNoLocal}@${train.ServerCode} reached signal ${signalId} from unknown signal ${prevSignalId}`
          );

          tryLogError(prevSignalId, signalId, `Unknown signal ${prevSignalId}`);
        }

        if (prevSignal && signal && !prevSignal.next_finalized) {
          // if signal is known and prevSignal is also known and not finalized

          let shouldIgnore = false;

          if (
            prevSignal.prevSignalConnections.some((conn) => conn.next === signalId) ||
            signal.nextSignalConnections.some((conn) => conn.prev === prevSignalId)
          ) {
            // connection already exists
            shouldIgnore = true;
          }

          if (
            !shouldIgnore &&
            (prevSignal.type === "block" || BLOCK_SIGNAL_REGEX.test(prevSignalId))
          ) {
            const isReverse = BLOCK_SIGNAL_REVERSE_REGEX.test(prevSignalId);

            // if prevSignal is reverse block signal then the next signal can't be a non-reverse block signal
            if (
              isReverse &&
              !BLOCK_SIGNAL_REVERSE_REGEX.test(signalId) &&
              BLOCK_SIGNAL_REGEX.test(signalId)
            ) {
              tryLogError(
                prevSignalId,
                signalId,
                `Block Signal ${prevSignalId} is reverse, but next signal ${signalId} is not reverse!`
              );
              shouldIgnore = true;
            }

            // if prevSignal a non-reverse block signal then the next signal can't be a reverse block signal
            if (!shouldIgnore && !isReverse && BLOCK_SIGNAL_REVERSE_REGEX.test(signalId)) {
              tryLogError(
                prevSignalId,
                signalId,
                `Block Signal ${prevSignalId} is not reverse, but next signal ${signalId} is reverse!`
              );
              shouldIgnore = true;
            }

            if (prevSignal.prevSignalConnections.length > 0) {
              // a block signal can only have one next signal
              tryLogError(
                prevSignalId,
                signalId,
                `Block Signal ${prevSignalId} already has a next signal, can't add ${signalId}!`
              );
              shouldIgnore = true;
            }
          }

          if (!shouldIgnore) {
            // add connection: prevSignal -> signal
            try {
              await prisma.signalConnections.create({
                data: {
                  prev: prevSignalId,
                  next: signalId,
                },
              });
            } catch (e) {
              tryLogError(
                prevSignalId,
                signalId,
                `Failed to create connection between ${prevSignalId} and ${signalId}: ${e}`
              );
            }
          }
        }
      }

      TrainPreviousSignals.set(trainId, signalId);
    }

    const duration = Date.now() - start;
    logger.info(`${trains.length} trains analyzed in ${duration}ms`);
    prisma.stats
      .create({
        data: {
          service_id: "SIGNALS-PROC",
          count: trains.length,
          duration: duration,
        },
      })
      .catch((e) => {
        logger.error(`Failed to log stats: ${e}`);
      });
  } catch (e) {
    logger.error(`Error analyzing trains: ${e}`);
  } finally {
    running = false;
  }
}

parentPort?.on("message", async (msg) => {
  switch (msg.type) {
    case "analyze":
      analyzeTrains(msg.data);
      break;
    default:
      logger.warn(`Unknown message type: ${msg.type}`);
      break;
  }
});
