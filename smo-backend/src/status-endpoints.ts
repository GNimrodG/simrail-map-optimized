import { Router, type Express } from "express";
import { serverFetcher } from "./fetchers/sever-fetcher";
import { getSignalsForTrains } from "./analytics/signal";
import { trainFetcher } from "./fetchers/train-fetcher";
import { getTrainId } from "./utils";
import { getTrainDelays } from "./analytics/train-delay";
import type { Server as SocketIOServer } from "socket.io";
import { timeFetcher } from "./fetchers/time-fetcher";
import { stationFetcher } from "./fetchers/station-fetcher";
import rateLimit from "express-rate-limit";
import { timetableFetcher } from "./fetchers/timetable-fetcher";

export function addStatusEndpoints(app: Express, io: SocketIOServer) {
  const router = Router();

  // Rate limit the status endpoint to 1 request per 5 seconds
  const limiter = rateLimit({
    windowMs: 5 * 1000,
    limit: 1,
  });

  router.use(limiter);

  router.get("/", async (_req, res) => {
    res.json({
      connectedClients: io.engine.clientsCount,
      servers: serverFetcher.currentData?.reduce<Record<string, number>>((prev, curr) => {
        prev[curr.ServerCode] = io.sockets.adapter.rooms.get(curr.ServerCode)?.size ?? 0;
        return prev;
      }, {}),
    });
  });

  router.use("/:server", (req, res, next) => {
    const serverId = req.params.server;

    if (!serverId) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const servers = serverFetcher.currentData;

    if (!servers) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    const server = servers.find((s) => s.ServerCode === serverId);

    if (!server) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    if (!server.IsActive) {
      res.status(404).json({ error: "Server not active", code: "server_not_active" });
      return;
    }

    res.locals.server = server;

    next();
  });

  router.get("/:server/delays", async (req, res) => {
    const trains = trainFetcher.getDataForServer(req.params.server);

    if (!trains) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    res.json(Object.fromEntries(trains.map((train) => [getTrainId(train), getTrainDelays(train)])));
  });

  router.get("/:server/signals", async (req, res) => {
    const trains = trainFetcher.getDataForServer(req.params.server);

    if (!trains) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    res.json(await getSignalsForTrains(trains));
  });

  router.get("/:server/trains", async (req, res) => {
    const trains = trainFetcher.getDataForServer(req.params.server);

    if (!trains) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    res.json(trains);
  });

  router.use("/:server/trains/:train", (req, res, next) => {
    const server = req.params.server;

    const trainId = req.params.train;

    if (!trainId) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const trains = trainFetcher.getDataForServer(server);

    if (!trains) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    const train = trains.find((t) => t.TrainNoLocal === trainId);

    if (!train) {
      res.status(404).json({ error: "Train not found", code: "train_not_found" });
      return;
    }

    res.locals.train = train;

    next();
  });

  router.get("/:server/trains/:train", async (req, res) => {
    res.json(res.locals.train);
  });

  router.get("/:server/trains/:train/delays", async (req, res) => {
    res.json(getTrainDelays(res.locals.train));
  });

  router.get("/:server/trains/:train/timetable", async (req, res) => {
    const server = req.params.server;
    const train = req.params.train;

    const timetable = await timetableFetcher.getTimeTableForTrain(server, train);

    if (!timetable) {
      res.status(404).json({ error: "Timetable not found", code: "timetable_not_found" });
      return;
    }

    res.json(timetable);
  });

  router.get("/:server/stations", async (req, res) => {
    const server = req.params.server;

    const stations = stationFetcher.getDataForServer(server);

    if (!stations) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    res.json(stations);
  });

  router.get("/:server/time", async (req, res) => {
    const server = req.params.server;

    const time = timeFetcher.getDataForServer(server);

    if (!time) {
      res.status(404).json({ error: "Server not found", code: "server_not_found" });
      return;
    }

    res.json(time);
  });

  app.use("/status", router);
}
