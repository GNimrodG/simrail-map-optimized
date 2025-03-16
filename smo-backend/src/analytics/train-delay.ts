import { LRUCache } from "lru-cache";
import { Train } from "../api-helper";
import { timetableFetcher } from "../fetchers/timetable-fetcher";
import { ModuleLogger } from "../logger";
import { timeFetcher } from "../fetchers/time-fetcher";
import { getTrainId } from "../utils";
import fs from "fs";
import { join } from "path";
import notepack from "notepack.io";
import { prisma } from "../db";
import { captureException } from "@sentry/node";

const logger = new ModuleLogger("TRAIN-DELAY");

const lastTimetableIndex = new LRUCache<string, number>({
  ttl: 1000 * 60 * 30, // 30 mins
  ttlAutopurge: true,
  updateAgeOnGet: true,
});

const LAST_TIMETABLE_INDEX_SAVE_FILE = join(process.cwd(), "data", "last-timetable-index.bin");
const LAST_TIMETABLE_INDEX_SAVE_INTERVAL = 1000 * 60 * 5; // 5 mins

if (fs.existsSync(LAST_TIMETABLE_INDEX_SAVE_FILE)) {
  const data = notepack.decode(fs.readFileSync(LAST_TIMETABLE_INDEX_SAVE_FILE));
  lastTimetableIndex.load(data);
}

function saveLastTimetableIndex(sync = false) {
  if (sync) {
    fs.writeFileSync(LAST_TIMETABLE_INDEX_SAVE_FILE, notepack.encode(lastTimetableIndex.dump()));
    logger.debug("Last timetable index saved.");
    return;
  }

  fs.writeFile(
    LAST_TIMETABLE_INDEX_SAVE_FILE,
    notepack.encode(lastTimetableIndex.dump()),
    { flag: "w" },
    (err) => {
      if (err) {
        logger.error(`Failed to save last timetable index: ${err.message}`);
      }

      logger.debug("Last timetable index saved.");
    }
  );
}

setInterval(saveLastTimetableIndex, LAST_TIMETABLE_INDEX_SAVE_INTERVAL);

const trainDelays = new LRUCache<string, Record<number, number>>({
  ttl: 1000 * 60 * 30, // 30 mins
  ttlAutopurge: true,
  updateAgeOnGet: true,
});

const TRAIN_DELAY_SAVE_FILE = join(process.cwd(), "data", "train-delays.bin");
const TRAIN_DELAY_SAVE_INTERVAL = 1000 * 60 * 5; // 5 mins

if (fs.existsSync(TRAIN_DELAY_SAVE_FILE)) {
  const data = notepack.decode(fs.readFileSync(TRAIN_DELAY_SAVE_FILE));
  trainDelays.load(data);
}

function saveTrainDelays(sync = false) {
  if (sync) {
    fs.writeFileSync(TRAIN_DELAY_SAVE_FILE, notepack.encode(trainDelays.dump()));
    logger.debug("Train delays saved.");
    return;
  }

  fs.writeFile(TRAIN_DELAY_SAVE_FILE, notepack.encode(trainDelays.dump()), { flag: "w" }, (err) => {
    if (err) {
      logger.error(`Failed to save train delays: ${err.message}`);
    }

    logger.debug("Train delays saved.");
  });
}

setInterval(saveTrainDelays, TRAIN_DELAY_SAVE_INTERVAL);

process.stdin.resume(); // so the program will not close instantly

function handleExit(exit = true) {
  saveLastTimetableIndex(true);
  saveTrainDelays(true);
  if (exit) process.exit();
}

process.on("exit", handleExit.bind(null, false));
process.on("SIGINT", handleExit);
process.on("SIGUSR1", handleExit);
process.on("SIGUSR2", handleExit);
process.on("uncaughtException", handleExit);

let isAnalyzing = false;

/**
 * Analyzes trains for delays by comparing scheduled vs actual departure times
 * @param trains - List of trains to analyze
 * @returns Promise that resolves when analysis is complete
 */
export async function analyzeTrainsForDelays(trains: Train[]) {
  if (isAnalyzing) {
    logger.warn("Train delay analysis is already in progress, skipping.");
    return;
  }

  isAnalyzing = true;
  const start = Date.now();

  try {
    const serverTimes = getServerTimes();
    if (!serverTimes) {
      logger.warn("Server times are not available, skipping delay analysis.");
      return;
    }

    await processTrains(trains, serverTimes);

    logPerformanceStats(trains.length, start);
  } catch (e) {
    logger.error(`Failed to analyze trains for delays: ${e}`);
  } finally {
    isAnalyzing = false;
  }
}

function calculateServerTime(serverData: {
  time: number;
  lastUpdated: number;
  timezone: number;
}): number {
  // Convert server time to current UTC time by:
  // 1. Taking the server's reported time
  // 2. Adding elapsed time since last update
  // 3. Adjusting for timezone offset
  return (
    serverData.time + (Date.now() - serverData.lastUpdated) - serverData.timezone * 60 * 60 * 1000
  );
}

function getServerTimes(): Record<string, number> | null {
  if (!timeFetcher.currentData) return null;

  return Object.fromEntries(
    Array.from(timeFetcher.currentData.entries(), ([server, data]) => [
      server,
      calculateServerTime(data),
    ])
  );
}

async function processTrains(trains: Train[], serverTimes: Record<string, number>) {
  for (const train of trains) {
    const trainId = getTrainId(train);

    try {
      await processTrainDelays(train, trainId, serverTimes);
    } catch (e) {
      captureException(e, { extra: { train, trainId } });
      logger.error(`Failed to analyze train ${trainId} for delays: ${e}`);
    }

    lastTimetableIndex.set(trainId, train.TrainData.VDDelayedTimetableIndex);
  }
}

function logPerformanceStats(trainCount: number, startTime: number) {
  const duration = Date.now() - startTime;
  logger.info(`${trainCount} trains analyzed in ${duration}ms`);

  prisma.stats
    .create({
      data: {
        service_id: "TRAIN-DELAY",
        count: trainCount,
        duration: duration,
        server_count: trainDelays.size,
      },
    })
    .catch((e) => {
      logger.error(`Failed to log stats: ${e}`);
    });
}

async function processTrainDelays(
  train: Train,
  trainId: string,
  serverTimes: Record<string, number>
) {
  const lastIndex = lastTimetableIndex.get(trainId);

  if (!lastIndex || train.TrainData.VDDelayedTimetableIndex <= lastIndex) {
    return;
  }

  const schedule = await timetableFetcher.getTimeTableForTrain(
    train.ServerCode,
    train.TrainNoLocal
  );

  if (!schedule) {
    logger.error(`Failed to fetch schedule for train ${trainId}`);
    return;
  }

  const lastStation = schedule.timetable[lastIndex];
  if (!lastStation) {
    logger.error(`Failed to fetch last station for train ${trainId}`);
    return;
  }

  if (!lastStation.departureTime) {
    logger.error(`Last station for train ${trainId} has no departure time!`);
    return;
  }

  const timeData = timeFetcher.currentData?.get(train.ServerCode);
  if (!timeData) {
    logger.error(`No time data for server ${train.ServerCode}`);
    return;
  }

  const scheduledDepartureTime = parseScheduledTime(lastStation.departureTime, timeData.timezone);
  const actualDepartureTime = serverTimes[train.ServerCode];

  if (!actualDepartureTime) {
    logger.error(`Failed to fetch actual departure time for train ${trainId}`);
    return;
  }

  const delay = Math.round((actualDepartureTime - scheduledDepartureTime) / 1000);

  logger.debug(
    `Train ${trainId} is delayed by ${(delay / 60).toFixed(0)} mins at ${lastStation.nameOfPoint}.`
  );

  const delays = trainDelays.get(trainId) || {};
  delays[lastIndex] = delay;
  trainDelays.set(trainId, delays);
}

export function getTrainDelays(train: Train) {
  return trainDelays.get(getTrainId(train));
}

const parseScheduledTime = (timeString: string, timezoneHours: number): number => {
  // Parse "yyyy-mm-dd hh:mm:ss" format
  const [datePart, timePart] = timeString.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);

  // Create date in UTC and adjust for timezone
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  // Adjust for the timezone (subtract because we need to convert from local to UTC)
  date.setTime(date.getTime() - timezoneHours * 60 * 60 * 1000);

  return date.getTime();
};
