import { parentPort } from "worker_threads";
import { Train } from "../api-helper";
import { prisma } from "../db";
import { ModuleLogger } from "../logger";
import { getTrainId } from "../utils";
const logger = new ModuleLogger("TRAIN-TRAILS-WORKER");

async function analyzeTrains(trains: Train[]) {
  try {
    const start = Date.now();
    const trainsWithLocation = trains.filter(
      (train) => train.TrainData.Latititute && train.TrainData.Longitute
    );

    if (trainsWithLocation.length === 0) {
      logger.warn("No trains with location data found!");
      return;
    }

    const PAGE_SIZE = 1000;

    const parts = Math.ceil(trainsWithLocation.length / PAGE_SIZE);

    for (let i = 0; i < parts; i++) {
      const data = trainsWithLocation
        .slice(i * PAGE_SIZE, i * PAGE_SIZE + PAGE_SIZE)
        .map((train) => ({
          train_id: train.id,
          point: `SRID=4326;POINT(${train.TrainData.Longitute} ${train.TrainData.Latititute})`,
          speed: train.TrainData.Velocity,
          creator: getTrainId(train),
        }));

      try {
        await prisma.$executeRawUnsafe(`
        INSERT INTO traintrails (train_id, point, speed, creator)
        VALUES ${data
          .map(
            (x) => `('${x.train_id}', ST_GeomFromText('${x.point}'), ${x.speed}, '${x.creator}')`
          )
          .join(",")}`);
      } catch (e) {
        logger.error(
          `Failed to insert train locations: (${i * PAGE_SIZE}-${i * PAGE_SIZE + PAGE_SIZE}) ${e}`
        );
      }
    }

    const duration = Date.now() - start;
    logger.info(`${trains.length} trains analyzed in ${duration}ms`);
    prisma.stats
      .create({
        data: {
          service_id: "TRAIN-TRAILS-PROC",
          count: trainsWithLocation.length,
          duration: duration,
          server_count: trains.length - trainsWithLocation.length,
        },
      })
      .catch((e) => {
        logger.error(`Failed to log stats: ${e}`);
      });
  } catch (e) {
    logger.error(`Failed to analyze trains: ${e}`);
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
