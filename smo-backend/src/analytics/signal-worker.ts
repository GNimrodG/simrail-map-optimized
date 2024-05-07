import { readFileSync, renameSync, statSync, writeFileSync } from "fs";
import type { Train } from "../api-helper";
import { parentPort } from "worker_threads";
import logger from "../logger";
import { Signal } from "./signal";

const SignalLocations = new Map<string, Signal>();

const TrainPreviousSignals = new Map<string, string>();

try {
  logger.info("Loading signals...", { module: "SIGNALS-WORKER" });
  readFileSync("data/signals.csv", "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .forEach((line) => {
      const [name, lat, lon, extra, accuracy, type, prevSignalsStr, nextSignalsStr] =
        line.split(";");
      SignalLocations.set(name, {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        extra,
        accuracy: parseFloat(accuracy),
        type: type || null,
        prevSignals: new Set(prevSignalsStr ? prevSignalsStr.split(",") : []),
        nextSignals: new Set(nextSignalsStr ? nextSignalsStr.split(",") : []),
      });
    });

  logger.info(`${SignalLocations.size} signals loaded`, { module: "SIGNALS-WORKER" });

  if (statSync("data/signals-old.csv")?.isFile()) {
    logger.info("Merging old signal data...", { module: "SIGNALS-WORKER" });
    let newCounter = 0;
    let accuracyCounter = 0;
    let typeCounter = 0;
    let prevSignalsCounter = 0;
    let nextSignalsCounter = 0;

    readFileSync("data/signals-old.csv", "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .forEach((line) => {
        const [name, lat, lon, extra, accuracyStr, type, prevSignalsStr, nextSignalsStr] =
          line.split(";");
        const accuracy = parseFloat(accuracyStr);
        const signal = SignalLocations.get(name);
        if (!signal) {
          SignalLocations.set(name, {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            extra,
            accuracy: accuracy,
            type: type || null,
            prevSignals: new Set(prevSignalsStr ? prevSignalsStr.split(",") : []),
            nextSignals: new Set(nextSignalsStr ? nextSignalsStr.split(",") : []),
          });
          newCounter++;
        } else {
          if (signal.accuracy > accuracy) {
            signal.accuracy = accuracy;
            signal.lat = parseFloat(lat);
            signal.lon = parseFloat(lon);
            accuracyCounter++;
          }

          if (!signal.type && type) {
            signal.type = type;
            typeCounter++;
          }

          if (prevSignalsStr) {
            signal.prevSignals = new Set([...signal.prevSignals, ...prevSignalsStr.split(",")]);
            prevSignalsCounter++;
          }

          if (nextSignalsStr) {
            signal.nextSignals = new Set([...signal.nextSignals, ...nextSignalsStr.split(",")]);
            nextSignalsCounter++;
          }
        }
      });

    renameSync("data/signals-old.csv", `data/signals-old-merged-${Date.now()}.csv`);

    logger.info(`[MERGE] ${newCounter} new signals added`, { module: "SIGNALS-WORKER" });
    logger.info(`[MERGE] ${accuracyCounter} signals' accuracy improved`, {
      module: "SIGNALS-WORKER",
    });
    logger.info(`[MERGE] ${typeCounter} signals' type set`, { module: "SIGNALS-WORKER" });
    logger.info(`[MERGE] ${prevSignalsCounter} signals had previous signals added`, {
      module: "SIGNALS-WORKER",
    });
    logger.info(`[MERGE] ${nextSignalsCounter} signals had next signals added`, {
      module: "SIGNALS-WORKER",
    });
  }
} catch (e) {
  logger.warn(`No signals file found (${e})`, { module: "SIGNALS-WORKER" });
}

parentPort?.postMessage({ SignalLocations, TrainPreviousSignals });

const BLOCK_SIGNAL_REGEX = /^\w\d+_\d+\w?$/;

function analyzeTrains(trains: Train[]) {
  const start = Date.now();
  let shouldSave = false;
  for (const train of trains) {
    if (!train.TrainData.Latititute || !train.TrainData.Longitute) {
      logger.warn(`Train ${train.TrainNoLocal} (${train.Type}) has no location data`, {
        module: "SIGNALS-WORKER",
      });
      continue;
    }

    if (!train.TrainData.SignalInFront) {
      continue;
    }

    const trainId = `${train.TrainNoLocal}@${train.ServerCode}`;
    const [signalId, extra] = train.TrainData.SignalInFront.split("@");

    const prevSignalId = TrainPreviousSignals.get(trainId);

    if (prevSignalId) {
      if (prevSignalId !== signalId) {
        // train trainId was at prevSignalName and now is at signalId
        const prevSignal = SignalLocations.get(prevSignalId);
        if (prevSignal) {
          // add signalId to prevSignal's next signals
          prevSignal.nextSignals.add(signalId);
          if (
            prevSignal.nextSignals.size > 1 &&
            BLOCK_SIGNAL_REGEX.test(prevSignalId) &&
            BLOCK_SIGNAL_REGEX.test(signalId)
          ) {
            const distances = Array.from(prevSignal.nextSignals)
              .map((nextSignalId) => {
                const nextSignal = SignalLocations.get(nextSignalId);
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
                prevSignal.nextSignals
              ).join(", ")}; keeping the closest one (${distances[0].nextSignalId})`,
              { module: "SIGNALS-WORKER" }
            );
            prevSignal.nextSignals = new Set([distances[0].nextSignalId]);
          }
          shouldSave = true;
        }

        const signal = SignalLocations.get(signalId);
        if (signal) {
          signal.prevSignals.add(prevSignalId);

          if (
            signal.prevSignals.size > 1 &&
            BLOCK_SIGNAL_REGEX.test(prevSignalId) &&
            BLOCK_SIGNAL_REGEX.test(signalId)
          ) {
            const distances = Array.from(signal.prevSignals)
              .map((prevSignalId) => {
                const prevSignal = SignalLocations.get(prevSignalId);
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
                signal.prevSignals
              ).join(", ")}; keeping the closest one (${distances[0].prevSignalId})`,
              { module: "SIGNALS-WORKER" }
            );
            signal.prevSignals = new Set([distances[0].prevSignalId]);
          }

          shouldSave = true;
        }

        TrainPreviousSignals.set(trainId, signalId);
      }
    } else {
      TrainPreviousSignals.set(trainId, signalId);
    }

    if (train.TrainData.DistanceToSignalInFront < 5) {
      const signal = SignalLocations.get(signalId);
      if (signal) {
        const canImprove = signal.accuracy > train.TrainData.DistanceToSignalInFront;
        const canSetType =
          !signal.type &&
          (train.TrainData.SignalInFrontSpeed === 60 ||
            train.TrainData.SignalInFrontSpeed === 100 ||
            BLOCK_SIGNAL_REGEX.test(signalId));
        if (!canImprove && !canSetType) {
          continue;
        }

        if (canImprove) {
          logger.info(
            `Signal ${signalId} accuracy updated from ${signal.accuracy}m to ${
              train.TrainData.DistanceToSignalInFront
            }m (${signal.accuracy - train.TrainData.DistanceToSignalInFront}m)`,
            { module: "SIGNALS-WORKER", level: "success" }
          );
        }

        if (canSetType) {
          if (BLOCK_SIGNAL_REGEX.test(signalId)) {
            logger.info(`Signal ${signalId} type set to block`, {
              module: "SIGNALS-WORKER",
              level: "success",
            });
          } else {
            logger.info(
              `Signal ${signalId} type set to main because of speed ${train.TrainData.SignalInFrontSpeed}km/h`,
              { module: "SIGNALS-WORKER", level: "success" }
            );
          }
        }
      } else {
        logger.info(
          `New signal detected: ${signalId} at ${train.TrainData.Latititute}, ${train.TrainData.Longitute} (${extra}) with accuracy ${train.TrainData.DistanceToSignalInFront}m`,
          { module: "SIGNALS-WORKER", level: "success" }
        );
      }

      SignalLocations.set(signalId, {
        lat: train.TrainData.Latititute,
        lon: train.TrainData.Longitute,
        extra,
        accuracy: train.TrainData.DistanceToSignalInFront,
        type: signal?.type || getSignalType(train),
        prevSignals: new Set(prevSignalId && prevSignalId !== signalId ? [prevSignalId] : []),
        nextSignals: new Set(),
      });

      shouldSave = true;
    }
  }

  logger.info(`${trains.length} trains analyzed in ${Date.now() - start}ms`, {
    module: "SIGNALS-WORKER",
  });

  if (shouldSave) {
    saveSignals();
  } else {
    parentPort?.postMessage({ TrainPreviousSignals });
  }
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

function saveSignals() {
  logger.info("Saving signals...", { module: "SIGNALS-WORKER" });

  const start = Date.now();

  parentPort?.postMessage({ SignalLocations, TrainPreviousSignals });

  const data = Array.from(SignalLocations.entries()).map(
    ([name, { lat, lon, extra, accuracy, type, prevSignals, nextSignals }]) =>
      `${name};${lat};${lon};${extra};${accuracy};${type || ""};${
        Array.from(prevSignals.values()).join(",") || ""
      };${Array.from(nextSignals.values()).join(",") || ""}`
  );

  const signalsStr = data.join("\n");

  const ioStart = Date.now();
  writeFileSync("data/signals.csv", signalsStr, { encoding: "utf-8", flag: "w" });
  const ioEnd = Date.now();

  if (ioEnd - ioStart > 1000) {
    logger.warn(`Saving signals file took longer than 1s (${ioEnd - ioStart}ms)`, {
      module: "SIGNALS-WORKER",
    });
  }

  logger.info(`${data.length} signals saved in ${Date.now() - start}ms`, {
    module: "SIGNALS-WORKER",
    level: "success",
  });

  if (Date.now() - start > 1000) {
    logger.warn("Saving signals took longer than 1s", { module: "SIGNALS-WORKER" });
  }
}

function distance(point1: [number, number], point2: [number, number]) {
  return Math.sqrt((point1[0] - point2[0]) ** 2 + (point1[1] - point2[1]) ** 2);
}

parentPort?.on("message", (msg) => {
  switch (msg.type) {
    case "analyze":
      analyzeTrains(msg.data);
      break;
    case "set-type": {
      const signal = SignalLocations.get(msg.data.id);
      if (signal) {
        signal.type = msg.data.type;
        logger.info(`Signal ${msg.data.id} type set to ${msg.data.type}`, {
          module: "SIGNALS-WORKER",
          level: "success",
        });
        saveSignals();
      }
      break;
    }
  }
});
