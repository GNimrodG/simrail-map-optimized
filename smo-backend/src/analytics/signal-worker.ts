import { readFileSync, renameSync, statSync } from "fs";
import type { Train } from "../api-helper";
import { parentPort } from "worker_threads";
import { ModuleLogger } from "../logger";
import { prisma } from "../db";

const logger = new ModuleLogger("SIGNALS-PROC-WORKER");

const TrainPreviousSignals = new Map<string, string>();

async function loadFileLinesToDatabase(lines: string[]) {
  let newSignalCount = 0;
  let accuracyImprovementCount = 0;
  let typeSetCount = 0;

  logger.info(`Loading ${lines.length} signals from file to the database...`);

  const prevNextToBeAdded = new Map<string, { prev: string[]; next: string[] }>();

  const results = await Promise.allSettled(
    lines
      .filter((line) => line.trim().length > 0)
      .map(async (line) => {
        const [name, lat, lon, extra, _accuracy, type, prevSignalsStr, nextSignalsStr] =
          line.split(";");

        const accuracy = parseFloat(_accuracy);

        const signal = await prisma.signals.findUnique({ where: { name } });
        if (!signal) {
          newSignalCount++;
          await prisma.$executeRaw`
            INSERT INTO signals (name, point, extra, accuracy, type)
            VALUES (${name}, ${`SRID=4326;POINT(${lat} ${lon})`}, ${extra}, ${accuracy}, ${type})
            `;

          prevNextToBeAdded.set(name, {
            prev: prevSignalsStr.split(","),
            next: nextSignalsStr.split(","),
          });
        } else {
          if (signal.accuracy > accuracy) {
            accuracyImprovementCount++;
            await prisma.$executeRaw`
              UPDATE signals
              SET point = ${`SRID=4326;POINT(${lat} ${lon})`}, accuracy = ${accuracy}
              WHERE name = ${name}
            `;
          }

          if (!signal.type && type) {
            typeSetCount++;
            await prisma.$executeRaw`
              UPDATE signals
              SET type = ${type}
              WHERE name = ${name}
            `;
          }

          prevNextToBeAdded.set(name, {
            prev: prevSignalsStr.split(","),
            next: nextSignalsStr.split(","),
          });
        }
      })
  );

  for (const [name, { prev, next }] of prevNextToBeAdded) {
    if (prev.length > 0) {
      for (const prevSignal of prev) {
        try {
          await prisma.$executeRaw`
          INSERT INTO prev_signals (signal, prev_signal)
          VALUES (${name}, ${prevSignal})
        `;
        } catch (e) {
          logger.error(`Failed to add prev signal ${prevSignal} to signal ${name}: ${e}`);
        }
      }
    }

    if (next.length > 0) {
      for (const nextSignal of next) {
        try {
          await prisma.$executeRaw`
          INSERT INTO next_signals (signal, next_signal)
          VALUES (${name}, ${nextSignal})
        `;
        } catch (e) {
          logger.error(`Failed to add next signal ${nextSignal} to signal ${name}: ${e}`);
        }
      }
    }
  }

  logger.info(
    `Loaded ${lines.length} signals from file to the database: ${newSignalCount} new signals, ${accuracyImprovementCount} accuracy improvements, ${typeSetCount} type sets`
  );

  if (results.some((result) => result.status === "rejected")) {
    logger.error("Some signals failed to load to the database");

    for (const result of results) {
      if (result.status === "rejected") {
        logger.debug(result.reason);
      }
    }
  }
}

try {
  statSync("data/signals.csv");
  logger.info("Loading signals...");
  loadFileLinesToDatabase(readFileSync("data/signals.csv", "utf-8").split("\n"));

  renameSync("data/signals.csv", `data/signals-${Date.now()}.csv`);

  logger.info(`Signals loaded from file to the database`);

  if (statSync("data/signals-old.csv")?.isFile()) {
    logger.info("Merging old signal data...");

    loadFileLinesToDatabase(readFileSync("data/signals-old.csv", "utf-8").split("\n"));

    renameSync("data/signals-old.csv", `data/signals-old-merged-${Date.now()}.csv`);
  }
} catch (e) {
  logger.warn(`No signals file found (${e})`);
}

parentPort?.postMessage({ TrainPreviousSignals });

const BLOCK_SIGNAL_REGEX = /^\w\d+_\d+\w?$/;
const BLOCK_SIGNAL_REVERSE_REGEX = /^\w\d+_\d+[A-Z]$/;

let running = false;

async function analyzeTrains(trains: Train[]) {
  if (running) {
    logger.warn("Already running, skipping...");
    return;
  }

  running = true;

  const start = Date.now();
  const signals = await prisma.signals.findMany({
    where: {
      name: {
        in: trains.map((train) => train?.TrainData?.SignalInFront?.split("@")[0]).filter(Boolean),
      },
    },
  });

  for (const train of trains) {
    if (!train.TrainData.Latititute || !train.TrainData.Longitute) {
      logger.warn(`Train ${train.TrainNoLocal} (${train.Type}) has no location data`);
      continue;
    }

    if (!train.TrainData.SignalInFront) {
      continue;
    }

    const trainId = `${train.TrainNoLocal}@${train.ServerCode}`;
    const [signalId, extra] = train.TrainData.SignalInFront.split("@");
    const signal = signals.find((signal) => signal.name === signalId);

    const prevSignalId = TrainPreviousSignals.get(trainId);

    if (prevSignalId && prevSignalId !== signalId) {
      // train trainId was at prevSignalName and now is at signalId
      const prevSignal =
        signals.find((signal) => signal.name === prevSignalId) ||
        (await prisma.signals.findUnique({ where: { name: prevSignalId } }));

      if (prevSignal) {
        if (signal) {
          // add signalId to prevSignal's next signals
          try {
            await prisma.$executeRaw`
            INSERT INTO next_signals (signal, next_signal)
            VALUES (${prevSignalId}, ${signalId})
            ON CONFLICT DO NOTHING
          `;
          } catch {
            // ignore
          }
        }

        const prevSignalNextSignals = await prisma.$queryRaw<string[]>`
            SELECT next_signal FROM next_signals WHERE signal = ${prevSignalId}
          `;

        if (
          prevSignalNextSignals.length > 1 &&
          BLOCK_SIGNAL_REGEX.test(prevSignalId) &&
          BLOCK_SIGNAL_REGEX.test(signalId)
        ) {
          const possibleNextSignals = prevSignalNextSignals.filter((nextSignalId) =>
            BLOCK_SIGNAL_REVERSE_REGEX.test(prevSignalId)
              ? BLOCK_SIGNAL_REVERSE_REGEX.test(nextSignalId)
              : !BLOCK_SIGNAL_REVERSE_REGEX.test(nextSignalId)
          );

          const nextSignals = await prisma.$queryRaw<{ name: string; lat: number; lon: number }[]>`
            SELECT name, ST_X(point) as lat, ST_Y(point) as lon
            FROM signals
            WHERE name IN (${possibleNextSignals})
          `;

          const distances = possibleNextSignals
            .map((nextSignalId) => {
              const nextSignal = nextSignals.find((signal) => signal.name === nextSignalId);

              if (!nextSignal) {
                return { nextSignalId, distance: Infinity };
              }

              return {
                nextSignalId,
                distance: distance(
                  [nextSignal.lat, nextSignal.lon],
                  [train.TrainData.Latititute, train.TrainData.Longitute]
                ),
              };
            })
            .toSorted((a, b) => a.distance - b.distance);

          logger.warn(
            `Block Signal ${prevSignalId} has more than 1 next signal: ${Array.from(
              prevSignalNextSignals
            ).join(", ")}; keeping the closest one (${distances[0].nextSignalId})`
          );

          await prisma.$executeRaw`
              DELETE FROM next_signals
              WHERE signal = ${prevSignalId} AND next_signal != ${distances[0].nextSignalId}
            `;
        }
      }

      if (signal) {
        // add prevSignalName to signal's prev signals
        await prisma.$executeRaw`
            INSERT INTO prev_signals (signal, prev_signal)
            VALUES (${signalId}, ${prevSignalId})
            ON CONFLICT DO NOTHING
          `;

        const signalPrevSignals = await prisma.$queryRaw<string[]>`
            SELECT prev_signal FROM prev_signals WHERE signal = ${signalId}
          `;

        if (
          signalPrevSignals.length > 1 &&
          BLOCK_SIGNAL_REGEX.test(prevSignalId) &&
          BLOCK_SIGNAL_REGEX.test(signalId)
        ) {
          const possiblePrevSignals = signalPrevSignals.filter((prevSignalId) =>
            BLOCK_SIGNAL_REVERSE_REGEX.test(signalId)
              ? BLOCK_SIGNAL_REVERSE_REGEX.test(prevSignalId)
              : !BLOCK_SIGNAL_REVERSE_REGEX.test(prevSignalId)
          );

          const prevSignals = await prisma.$queryRaw<{ name: string; lat: number; lon: number }[]>`
            SELECT name, ST_X(point) as lat, ST_Y(point) as lon
            FROM signals
            WHERE name IN (${possiblePrevSignals})
          `;

          const distances = signalPrevSignals
            .filter((prevSignalId) =>
              BLOCK_SIGNAL_REVERSE_REGEX.test(signalId)
                ? BLOCK_SIGNAL_REVERSE_REGEX.test(prevSignalId)
                : !BLOCK_SIGNAL_REVERSE_REGEX.test(prevSignalId)
            )
            .map((prevSignalId) => {
              const prevSignal = prevSignals.find((signal) => signal.name === prevSignalId);

              if (!prevSignal) {
                return { prevSignalId, distance: Infinity };
              }

              return {
                prevSignalId,
                distance: distance(
                  [prevSignal.lat, prevSignal.lon],
                  [train.TrainData.Latititute, train.TrainData.Longitute]
                ),
              };
            })
            .toSorted((a, b) => a.distance - b.distance);

          logger.warn(
            `Block Signal ${signalId} has more than 1 prev signal: ${Array.from(
              signalPrevSignals
            ).join(", ")}; keeping the closest one (${distances[0].prevSignalId})`
          );

          await prisma.$executeRaw`
              DELETE FROM prev_signals
              WHERE signal = ${signalId} AND prev_signal != ${distances[0].prevSignalId}
            `;
        }
      }
    }

    TrainPreviousSignals.set(trainId, signalId);

    if (train.TrainData.DistanceToSignalInFront < 5) {
      const signal = await prisma.signals.findUnique({ where: { name: signalId } });
      if (signal) {
        if (signal.accuracy > train.TrainData.DistanceToSignalInFront) {
          await prisma.$executeRaw`
            UPDATE signals
            SET accuracy = ${
              train.TrainData.DistanceToSignalInFront
            }, point = ${`SRID=4326;POINT(${train.TrainData.Latititute} ${train.TrainData.Longitute})`}
            WHERE name = ${signalId}
          `;
          logger.success(
            `Signal ${signalId} accuracy updated from ${signal.accuracy}m to ${
              train.TrainData.DistanceToSignalInFront
            }m (${signal.accuracy - train.TrainData.DistanceToSignalInFront}m)`
          );
        }

        if (
          !signal.type &&
          (train.TrainData.SignalInFrontSpeed === 60 ||
            train.TrainData.SignalInFrontSpeed === 100 ||
            BLOCK_SIGNAL_REGEX.test(signalId))
        ) {
          await prisma.$executeRaw`
            UPDATE signals
            SET type = ${getSignalType(train)}
            WHERE name = ${signalId}
          `;
          logger.success(
            `Signal ${signalId} type set to ${
              BLOCK_SIGNAL_REGEX.test(signalId) ? "block" : "main"
            } because of speed ${train.TrainData.SignalInFrontSpeed}km/h`
          );
        }
      } else {
        logger.success(
          `New signal detected: ${signalId} at ${train.TrainData.Latititute}, ${train.TrainData.Longitute} (${extra}) with accuracy ${train.TrainData.DistanceToSignalInFront}m`
        );
      }
    }
  }

  logger.info(`${trains.length} trains analyzed in ${Date.now() - start}ms`);

  running = false;
}

function getSignalType(train: Train) {
  if (train.TrainData.SignalInFrontSpeed === 60 || train.TrainData.SignalInFrontSpeed === 100) {
    return "main";
  }

  if (BLOCK_SIGNAL_REGEX.test(train.TrainData.SignalInFront)) {
    return "block";
  }

  return null;
}

function distance(point1: [number, number], point2: [number, number]) {
  return Math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2);
}

parentPort?.on("message", async (msg) => {
  switch (msg.type) {
    case "analyze":
      analyzeTrains(msg.data);
      break;
    case "set-type": {
      const signal = await prisma.signals.findUnique({ where: { name: msg.data.id } });
      if (signal) {
        await prisma.$executeRaw`
          UPDATE signals
          SET type = ${msg.data.type}
          WHERE name = ${msg.data.id}
        `;

        logger.success(`Signal ${msg.data.id} type set to ${msg.data.type}`);
      }
      break;
    }
    case "remove-prev-signal": {
      const signal = await prisma.signals.findUnique({ where: { name: msg.data.signal } });
      if (signal) {
        await prisma.$executeRaw`
          DELETE FROM prev_signals
          WHERE signal = ${msg.data.signal} AND prev_signal = ${msg.data.prevSignal}
        `;

        logger.success(`Signal ${msg.data.signal} prev signal ${msg.data.prevSignal} removed`);
      }
      break;
    }
    case "remove-next-signal": {
      const signal = await prisma.signals.findUnique({ where: { name: msg.data.signal } });
      if (signal) {
        await prisma.$executeRaw`
          DELETE FROM next_signals
          WHERE signal = ${msg.data.signal} AND next_signal = ${msg.data.nextSignal}
        `;

        logger.success(`Signal ${msg.data.signal} next signal ${msg.data.nextSignal} removed`);
      }
      break;
    }
    case "add-prev-signal": {
      const signal = await prisma.signals.findUnique({ where: { name: msg.data.signal } });
      if (signal) {
        await prisma.$executeRaw`
          INSERT INTO prev_signals (signal, prev_signal)
          VALUES (${msg.data.signal}, ${msg.data.prevSignal})
        `;

        logger.success(`Signal ${msg.data.signal} prev signal ${msg.data.prevSignal} added`);
      }
      break;
    }
    case "add-next-signal": {
      const signal = await prisma.signals.findUnique({ where: { name: msg.data.signal } });
      if (signal) {
        await prisma.$executeRaw`
          INSERT INTO next_signals (signal, next_signal)
          VALUES (${msg.data.signal}, ${msg.data.nextSignal})
        `;

        logger.success(`Signal ${msg.data.signal} next signal ${msg.data.nextSignal} added`);
      }
      break;
    }
  }
});
