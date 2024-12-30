import type { Train } from "../api-helper";
import { parentPort } from "worker_threads";
import { ModuleLogger } from "../logger";
import { prisma } from "../db";
import TTLCache from "@isaacs/ttlcache";
import {
  BLOCK_SIGNAL_REGEX,
  BLOCK_SIGNAL_REVERSE_REGEX,
  getSignalRole,
  getSignalType,
  getTrainId,
  tryLogError,
} from "./signal-utils";

const logger = new ModuleLogger("SIGNALS-PROC-WORKER");
const MIN_DISTANCE_TO_SIGNAL =
  (process.env.MIN_DISTANCE_TO_SIGNAL && parseInt(process.env.MIN_DISTANCE_TO_SIGNAL)) || 10;

logger.info(`Min distance to signal to discover: ${MIN_DISTANCE_TO_SIGNAL}m`);

const MIN_DISTANCE_BETWEEN_SIGNALS =
  (process.env.MIN_DISTANCE_BETWEEN_SIGNALS &&
    parseInt(process.env.MIN_DISTANCE_BETWEEN_SIGNALS)) ||
  200;

logger.info(`Min distance between signals: ${MIN_DISTANCE_BETWEEN_SIGNALS}m`);

const BUFFER_DISTANCE_BETWEEN_POSITIONS =
  (process.env.BUFFER_DISTANCE_BETWEEN_POSITIONS &&
    parseInt(process.env.BUFFER_DISTANCE_BETWEEN_POSITIONS)) ||
  300;

logger.info(`Buffer distance between positions: ${BUFFER_DISTANCE_BETWEEN_POSITIONS}m`);

// if we don't get info about a train for 30 seconds, then we clear it from the cache so it doesn't create a wrong connection
const TrainPreviousSignals = new TTLCache<
  string,
  [
    prevSignalName: string,
    prevSignalSpeed: number,
    prevLocation: { lon: number; lat: number },
    prevTime: number,
    prevSpeed: number
  ]
>({
  ttl: 1000 * 30, // 30 sec
  updateAgeOnGet: true,
});

type SignalData = {
  prevSignalConnections: {
    next: string;
  }[];
  nextSignalConnections: {
    prev: string;
  }[];
  name: string;
  accuracy: number;
  type: string | null;
  role: string | null;
  prev_finalized: boolean;
  next_finalized: boolean;
  prev_regex: string | null;
  next_regex: string | null;
  pos?: { lat: number; lon: number };
};

type ConnectionValidator = (
  prev: SignalData,
  curr: SignalData
) => true | string | null | Promise<true | string | null>;

// Return true if connection is valid, otherwise return error message or null if connection should be ignored
const CONNECTION_VALIDATORS: ConnectionValidator[] = [
  (prev, curr) =>
    // check if connection already exists
    (!prev.prevSignalConnections.some((conn) => conn.next === curr.name) &&
      !curr.nextSignalConnections.some((conn) => conn.prev === prev.name)) ||
    null,
  (prev, curr) =>
    // check if connection already exists in the other direction
    (prev.nextSignalConnections.every((conn) => conn.prev !== curr.name) &&
      curr.prevSignalConnections.every((conn) => conn.next !== prev.name)) ||
    `Connection between ${prev.name} and ${curr.name} already exists in the other direction!`,
  (prev, curr) =>
    // check if prevSignal's next regex is valid for the current signal
    !prev.next_regex ||
    new RegExp(prev.next_regex).test(curr.name) ||
    `Signal ${curr.name} doesn't match ${prev.name}'s next regex!`,
  (prev, curr) => {
    // check for block signal limitations
    if (prev.type === "block") {
      const isReverse = BLOCK_SIGNAL_REVERSE_REGEX.test(prev.name);

      // if prevSignal is reverse block signal then the next signal can't be a non-reverse block signal
      if (
        isReverse &&
        !BLOCK_SIGNAL_REVERSE_REGEX.test(curr.name) &&
        BLOCK_SIGNAL_REGEX.test(curr.name)
      ) {
        return `Block Signal ${prev.name} is reverse, but next signal ${curr.name} is not reverse!`;
      }

      // if prevSignal a non-reverse block signal then the next signal can't be a reverse block signal
      if (!isReverse && BLOCK_SIGNAL_REVERSE_REGEX.test(curr.name)) {
        return `Block Signal ${prev.name} is not reverse, but next signal ${curr.name} is reverse!`;
      }

      if (prev.prevSignalConnections.length > 0) {
        // a block signal can only have one next signal
        return `Block Signal ${prev.name} already has a next signal, can't add ${curr.name}!`;
      }
    }

    return true;
  },
  (prev, curr) =>
    // check if signals are parallel
    curr.name.replace(/(_[A-Z])\d+$/, "$1") !== prev.name.replace(/(_[A-Z])\d+$/, "$1") ||
    `Signals ${prev.name} and ${curr.name} are probably parallel and can't be connected!`,
  (prev, curr) => {
    const prevMatch = RegExp(/_([A-Z])$/).exec(prev.name);
    const currMatch = RegExp(/_([A-Z])$/).exec(curr.name);

    if (
      prevMatch?.[1] &&
      currMatch?.[1] &&
      Math.abs(prevMatch[1].charCodeAt(0) - currMatch[1].charCodeAt(0)) === 1 // check if letters are next to each other
    ) {
      return `Signals ${prev.name} and ${curr.name} are probably parallel and can't be connected!`;
    }

    return true;
  },
  async (prev, curr) => {
    const prevPos = prev.pos || (await getSignalPos(prev.name));
    const currPos = curr.pos || (await getSignalPos(curr.name));

    if (!prevPos || !currPos) {
      return `Failed to get position for signals ${prev.name} and/or ${curr.name}!`;
    }

    // check if distance between signals is less than MIN_DISTANCE_BETWEEN_SIGNALS
    const distance = await getDistanceBetweenPoints(
      prevPos.lat,
      prevPos.lon,
      currPos.lat,
      currPos.lon
    );

    if (distance < MIN_DISTANCE_BETWEEN_SIGNALS) {
      return `Signals ${prev.name} and ${curr.name} are too close (${distance}m)!`;
    }

    return true;
  },
];

async function getSignalPos(name: string) {
  return prisma.$queryRaw<{ lat: number; lon: number }[]>`
    SELECT ST_X(point) as lon, ST_Y(point) as lat
    FROM signals
    WHERE name = ${name}
    `.then((res) => res[0]);
}

async function getDistanceForTrains(trains: Train[]) {
  const data = await Promise.all(
    trains
      .map((t) => ({
        id: t.id,
        currPoint: { lat: t.TrainData.Latititute, lon: t.TrainData.Longitute },
        prevPoint: TrainPreviousSignals.get(getTrainId(t))?.[2],
      }))
      .filter(({ prevPoint }) => !!prevPoint)
      .map(({ id, currPoint, prevPoint }) =>
        getDistanceBetweenPoints(prevPoint!.lat, prevPoint!.lon, currPoint.lat, currPoint.lon)
          .then((distance) => ({ id, distance }))
          .catch((e) => {
            logger.error(`Failed to get distance for train ${id}: ${e}`);
            return { id, distance: null };
          })
      )
  );

  return Object.fromEntries(data.map(({ id, distance }) => [id, distance]));
}

async function getDistanceBetweenPoints(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    throw new Error(`Invalid coordinates: ${lat1}, ${lon1}, ${lat2}, ${lon2}`);
  }

  return prisma
    .$queryRawUnsafe<{ distance: number }[]>(
      `SELECT ST_DistanceSphere(ST_GeomFromText('POINT(${lon1} ${lat1})', 4326), ST_GeomFromText('POINT(${lon2} ${lat2})', 4326)) as distance`
    )
    .then((res) => res[0].distance);
}

async function updateSignalRoles() {
  const count = await prisma.signals.count();

  if (count === 0) {
    logger.warn("No signals found, skipping role update...");
    return;
  }

  const parts = Math.ceil(count / 1000);

  for (let i = 0; i < parts; i++) {
    const signals = await prisma.signals.findMany({
      skip: i * 1000,
      take: 1000,
      select: {
        name: true,
        nextSignalConnections: { select: { prev: true } },
        prevSignalConnections: { select: { next: true } },
      },
    });

    for (const signal of signals) {
      const role = getSignalRole(signal);

      try {
        await prisma.signals.update({
          where: { name: signal.name },
          data: { role: role },
        });
      } catch (e) {
        logger.error(`Failed to set signal ${signal.name} role to ${role}: ${e}`);
      }
    }
  }

  logger.success(`Updated roles for ${count} signals!`);
}

updateSignalRoles();

let running = false;

async function analyzeTrains(trains: Train[]) {
  if (running) {
    logger.warn("Already running, skipping...");
    return;
  }

  running = true;

  try {
    const start = Date.now();
    let invalidTrains = 0;
    const signals = await prisma.signals.findMany({
      where: {
        name: {
          in: [
            ...trains.map((train) => train?.TrainData?.SignalInFront?.split("@")[0]),
            ...Array.from(TrainPreviousSignals.values(), (x) => x?.[0]).filter(Boolean),
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
        prev_regex: true,
        next_regex: true,
        prevSignalConnections: { select: { next: true } },
        nextSignalConnections: { select: { prev: true } },
      },
    });

    const distanceData = await getDistanceForTrains(trains);

    for (const train of trains) {
      const trainId = getTrainId(train);

      if (!train.TrainData.Latititute || !train.TrainData.Longitute) {
        logger.warn(
          `Train ${train.TrainNoLocal}@${train.ServerCode} (${train.Type}) has no location data!`
        );
        TrainPreviousSignals.get(trainId); // update TTL
        continue;
      }

      if (!train.TrainData.SignalInFront) {
        // this happens when the train is really far away from any signal (~5km+)
        TrainPreviousSignals.get(trainId); // update TTL
        continue;
      }

      const [signalId, extra] = train.TrainData.SignalInFront.split("@");
      let signal: SignalData | undefined = signals.find((signal) => signal.name === signalId);
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

          logger.success(`Signal ${signalId} type set to ${type}! (train: ${trainId})`);
        } catch (e) {
          logger.error(`Failed to set signal ${signalId} type to ${type}: ${e}`);
        }
      }

      // check if signal accuracy could be updated
      if (train.TrainData.DistanceToSignalInFront < MIN_DISTANCE_TO_SIGNAL) {
        if (signal) {
          // signal already exists
          if (signal.accuracy > train.TrainData.DistanceToSignalInFront) {
            // accuracy improved
            try {
              await prisma.$executeRaw`
                UPDATE signals
                SET
                  accuracy = ${train.TrainData.DistanceToSignalInFront},
                  point = ${`SRID=4326;POINT(${train.TrainData.Longitute} ${train.TrainData.Latititute})`}
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
              INSERT INTO signals (name, point, extra, accuracy, type, creator)
              VALUES (${signalId}, ${`SRID=4326;POINT(${train.TrainData.Longitute} ${train.TrainData.Latititute})`}, ${extra}, ${
              train.TrainData.DistanceToSignalInFront
            }, ${type}, ${trainId})`;

            signal = {
              name: signalId,
              accuracy: train.TrainData.DistanceToSignalInFront,
              type: type,
              role: null,
              prev_finalized: false,
              next_finalized: false,
              prev_regex: null,
              next_regex: null,
              prevSignalConnections: [],
              nextSignalConnections: [],
              pos: { lat: train.TrainData.Latititute, lon: train.TrainData.Longitute },
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

      const prevSignalData = TrainPreviousSignals.get(trainId);

      if (prevSignalData) {
        const [prevSignalId, prevSignalSpeed, _prevLocation, prevTime, prevSpeed] = prevSignalData;

        // Convert prevSpeed from km/h to m/s
        const prevSpeedInMetersPerSecond = prevSpeed * (1000 / 3600);

        // Calculate the time difference in seconds
        const timeDifferenceInSeconds = (Date.now() - prevTime) / 1000;

        // Calculate the maximum possible distance in meters
        const maxDistancePossible =
          prevSpeedInMetersPerSecond * timeDifferenceInSeconds + BUFFER_DISTANCE_BETWEEN_POSITIONS;

        const distance = distanceData[train.id];

        let isValid = true;

        if (typeof distance !== "number") {
          logger.warn(`Failed to get distance for train ${trainId}, ignoring current location!`);
          isValid = false;
        } else if (distance > maxDistancePossible) {
          logger.warn(
            `Train ${trainId} moved too far (${distance.toFixed(
              0
            )}m > ${maxDistancePossible.toFixed(
              0
            )}m; ${prevSpeed}km/h; ${timeDifferenceInSeconds}s) ignoring current location!`
          );

          isValid = false;
        }

        if (!isValid) {
          invalidTrains++;
        }

        if (isValid && prevSignalId !== signalId && !signal?.prev_finalized) {
          // train reached a new signal from a previous signal

          const prevSignal =
            signals.find((signal) => signal.name === prevSignalId) ||
            (await prisma.signals.findUnique({
              where: { name: prevSignalId },
              select: {
                name: true,
                accuracy: true,
                type: true,
                role: true,
                prev_finalized: true,
                next_finalized: true,
                prev_regex: true,
                next_regex: true,
                prevSignalConnections: { select: { next: true } },
                nextSignalConnections: { select: { prev: true } },
              },
            }));

          if (!prevSignal) {
            logger.warn(
              `Train ${trainId} reached ${
                signal ? "" : "unknown "
              }signal ${signalId} from unknown signal ${prevSignalId}`
            );
          } else if (signal && !prevSignal.next_finalized) {
            // if signal is known and prevSignal is also known and not finalized

            let shouldIgnore = false;

            for (const validator of CONNECTION_VALIDATORS) {
              try {
                const result = await validator(prevSignal, signal);

                if (result === true) {
                  continue;
                }

                if (result === null) {
                  shouldIgnore = true;
                  break;
                }

                tryLogError(prevSignalId, signalId, result, trainId);
                shouldIgnore = true;
                break;
              } catch (e) {
                logger.error(
                  `Error while validating connection ${prevSignalId}->${signalId} using validator #${CONNECTION_VALIDATORS.indexOf(
                    validator
                  )} for train ${trainId}: ${e}`
                );
                shouldIgnore = true;
                break;
              }
            }

            if (prevSignalSpeed === 0) {
              // if prevSignal is a stop signal, then we should ignore the connection
              logger.warn(
                `Train ${trainId} reached signal ${signalId} from stop signal ${prevSignalId}, ignoring connection!`
              );
              shouldIgnore = true;
            }

            if (!shouldIgnore) {
              // add connection: prevSignal -> signal
              try {
                await prisma.signalConnections.create({
                  data: {
                    prev: prevSignalId,
                    next: signalId,
                    creator: trainId,
                    vmax: prevSignalSpeed || null,
                  },
                });
              } catch (e) {
                tryLogError(
                  prevSignalId,
                  signalId,
                  `Failed to create connection between ${prevSignalId} and ${signalId}: ${e}`,
                  trainId
                );
              }
            }
          }
        }
      }

      TrainPreviousSignals.set(trainId, [
        signalId,
        train.TrainData.SignalInFrontSpeed,
        { lat: train.TrainData.Latititute, lon: train.TrainData.Longitute },
        Date.now(),
        train.TrainData.Velocity,
      ]);
    }

    const duration = Date.now() - start;
    logger.info(`${trains.length} trains analyzed in ${duration}ms`);
    prisma.stats
      .create({
        data: {
          service_id: "SIGNALS-PROC",
          count: trains.length,
          duration: duration,
          server_count: invalidTrains,
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
    case "get-train-previous-signal":
      parentPort?.postMessage({
        type: "train-previous-signal",
        data: Object.fromEntries(TrainPreviousSignals.entries()),
      });
      break;
    default:
      logger.warn(`Unknown message type: ${msg.type}`);
      break;
  }
});
