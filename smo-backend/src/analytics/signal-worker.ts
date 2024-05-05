import { readFileSync, writeFileSync } from "fs";
import type { Train } from "../api-helper";
import { parentPort } from "worker_threads";
import logger from "../logger";

const SignalLocations = new Map<
  string,
  { lat: number; lon: number; extra: string; accuracy: number }
>();

try {
  logger.info("Loading signals...", { module: "SIGNALS" });
  readFileSync("data/signals.csv", "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .forEach((line) => {
      const [name, lat, lon, extra, accuracy] = line.split(";");
      SignalLocations.set(name, {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        extra,
        accuracy: parseFloat(accuracy),
      });
    });

  logger.info(`${SignalLocations.size} signals loaded`, { module: "SIGNALS-WORKER" });
} catch {
  logger.warn("No signals file found", { module: "SIGNALS-WORKER" });
}

parentPort?.postMessage(SignalLocations);

function analyzeTrains(trains: Train[]) {
  for (const train of trains) {
    if (
      train.TrainData.Latititute &&
      train.TrainData.Longitute &&
      train.TrainData.SignalInFront &&
      train.TrainData.DistanceToSignalInFront < 5
    ) {
      const [signalId, extra] = train.TrainData.SignalInFront.split("@");
      if (SignalLocations.has(signalId)) {
        const signal = SignalLocations.get(signalId)!;
        if (signal.accuracy <= train.TrainData.DistanceToSignalInFront) {
          continue;
        }
        logger.info(
          `Signal ${signalId} accuracy updated from ${signal.accuracy}m to ${
            train.TrainData.DistanceToSignalInFront
          }m (${signal.accuracy - train.TrainData.DistanceToSignalInFront}m)`,
          { module: "SIGNALS", level: "success" }
        );
      } else {
        logger.info(
          `New signal detected: ${signalId} at ${train.TrainData.Latititute}, ${train.TrainData.Longitute} (${extra}) with accuracy ${train.TrainData.DistanceToSignalInFront}m`,
          { module: "SIGNALS", level: "success" }
        );
      }

      SignalLocations.set(signalId, {
        lat: train.TrainData.Latititute,
        lon: train.TrainData.Longitute,
        extra,
        accuracy: train.TrainData.DistanceToSignalInFront,
      });
    }
  }

  saveSignals();
}

function saveSignals() {
  logger.info("Saving signals...", { module: "SIGNALS" });
  const start = Date.now();
  const data = Array.from(SignalLocations.entries()).map(
    ([name, { lat, lon, extra, accuracy }]) => `${name};${lat};${lon};${extra};${accuracy}`
  );

  const signalsStr = data.join("\n");

  const ioStart = Date.now();
  writeFileSync("data/signals.csv", signalsStr, { encoding: "utf-8", flag: "w" });
  const ioEnd = Date.now();

  if (ioEnd - ioStart > 1000) {
    logger.warn(`Saving signals file took longer than 1s (${ioEnd - ioStart}ms)`, {
      module: "SIGNALS",
    });
  }

  logger.info(`${data.length} signals saved in ${Date.now() - start}ms`, {
    module: "SIGNALS",
    level: "success",
  });

  if (Date.now() - start > 1000) {
    logger.warn("Saving signals took longer than 1s", { module: "SIGNALS" });
  }
}

parentPort?.on("message", analyzeTrains);
