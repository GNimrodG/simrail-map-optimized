if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

import "./instrument";
import logger from "./logger";

if (!process.env.DATABASE_URL) {
  logger.error("DATABASE_URL is not set.");
  process.exit(1);
}

import * as Sentry from "@sentry/node";
import * as http from "http";
import * as https from "https";
import { readFileSync } from "fs";
import { Server as SocketIOServer } from "socket.io";
import {
  addSignalNextSignal,
  addSignalPrevSignal,
  analyzeTrainsForSignal,
  checkSignalExists,
  deleteSignal,
  getSignal,
  getSignalsForTrains,
  removeSignalNextSignal,
  removeSignalPrevSignal,
  updateSignal,
} from "./analytics/signal";
import { analyzeTrainsForRoutes, getRoutePoints } from "./analytics/route";
import { serverFetcher } from "./fetchers/sever-fetcher";
import { stationFetcher } from "./fetchers/station-fetcher";
import { trainFetcher } from "./fetchers/train-fetcher";
import { timeFetcher } from "./fetchers/time-fetcher";
import { timetableFetcher } from "./fetchers/timetable-fetcher";
import { filter, take } from "rxjs";
import msgpackParser from "socket.io-msgpack-parser";
import cors from "cors";
import express from "express";
import { analyzeTrainsForTrail } from "./analytics/train-trails";
import {
  analyzeTrainsForDelays,
  getServerPunctuality,
  getTrainDelays,
} from "./analytics/train-delay";
import { addStatusEndpoints } from "./status-endpoints";

function buildHttpsServer(
  app: http.RequestListener<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined
) {
  const cert = readFileSync(process.env.CERTFILE as string);
  const key = readFileSync(process.env.KEYFILE as string);
  return https.createServer({ key, cert }, app);
}

const app = express();

const webServer = process.env.CERTFILE ? buildHttpsServer(app) : http.createServer(app);

const io = new SocketIOServer(webServer, {
  cors: {
    origin: "*",
  },
  parser: msgpackParser,
});

serverFetcher.start();
serverFetcher.data$
  .pipe(
    filter((x) => !!x),
    take(1)
  )
  .subscribe((data) => {
    logger.info(
      "Initial server data fetched, starting other fetchers. Server count: " + data.length
    );
    trainFetcher.start();
    stationFetcher.start();
    timeFetcher.start();
    timetableFetcher.start();
  });

io.on("connection", (socket) => {
  logger.info(
    `Client connected from ${
      socket.handshake.headers["x-forwarded-for"]?.toString().split(",")?.[0] ||
      socket.handshake.address
    }, total clients: ${io.engine.clientsCount}`,
    {
      client: socket.id,
    }
  );

  socket.emit("servers", serverFetcher.currentData);

  socket.on("switch-server", async (room, cb) => {
    logger.info(`Switching to server ${room}.`, { client: socket.id });

    if (socket.data.serverCode) {
      socket.leave(socket.data.serverCode);
    }

    socket.join(room);
    socket.data.serverCode = room;

    cb?.(true);

    const stations = stationFetcher.getDataForServer(room);

    if (stations) {
      socket.emit("stations", stations);
    }

    const trains = trainFetcher.getDataForServer(room);

    if (trains) {
      socket.emit("trains", trains);

      const signals = await getSignalsForTrains(trains);

      if (signals) {
        socket.emit("signals", signals);
      }
    }

    const time = timeFetcher.getDataForServer(room);

    if (time) {
      socket.emit("time", time);
    }
  });

  socket.on("get-train-timetable", async (train: string | null, cb) => {
    if (train) {
      const timetable = await timetableFetcher.getTimeTableForTrain(socket.data.serverCode, train);
      cb?.(timetable || null);
    } else {
      cb?.(null);
    }
  });

  socket.on("get-train-route-points", async (trainRoute: string | null, cb) => {
    if (trainRoute) {
      const route = await getRoutePoints(trainRoute);
      cb?.(route);
    } else {
      cb?.(null);
    }
  });

  socket.on("disconnect", (r) => {
    logger.info(`Client disconnected: ${r}, total: ${io.engine.clientsCount}`, {
      client: socket.id,
    });
  });
});

serverFetcher.data$.subscribe((data) => {
  io.emit("servers", data);
});

stationFetcher.perServerData$.subscribe((data) => {
  io.to(data.server).emit("stations", data.data);
});

trainFetcher.perServerData$.subscribe(async (data) => {
  io.to(data.server).emit("trains", data.data);

  io.to(data.server).emit("signals", await getSignalsForTrains(data.data));

  io.to(data.server).emit(
    "delays",
    Object.fromEntries(data.data.map((train) => [train.id, getTrainDelays(train)]))
  );
});

timeFetcher.perServerData$.subscribe((data) => {
  io.to(data.server).emit("time", data.data);
});

trainFetcher.data$.subscribe((data) => {
  if (!data) return;

  const trains = Array.from(data.values()).flatMap((trains) => trains);
  logger.debug(`There are ${trains.length} trains in total.`);

  if (!process.env.DISABLE_SIGNAL_ANALYSIS) {
    analyzeTrainsForSignal(trains);
  }

  if (process.env.ENABLE_TRAIL_ANALYSIS) {
    analyzeTrainsForTrail(trains);
  }

  if (!process.env.DISABLE_ROUTE_ANALYSIS) {
    analyzeTrainsForRoutes(trains);
  }

  analyzeTrainsForDelays(trains);
});

app.use(
  cors({
    maxAge: 24 * 60 * 60, // 24 hours
  })
);

addStatusEndpoints(app, io);

// Prometheus metrics
app.get("/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8; escaping=values");
  res.send(
    `
# HELP smo_connected_clients Number of connected clients
# TYPE smo_connected_clients gauge
smo_connected_clients ${io.engine.clientsCount}

# HELP smo_server_clients Number of clients connected to each server
# TYPE smo_server_clients gauge
${serverFetcher.currentData
  ?.map(
    (server) =>
      `smo_server_clients{server="${server.ServerCode}"} ${
        io.sockets.adapter.rooms.get(server.ServerCode)?.size || 0
      }`
  )
  .join("\n")}

# HELP smo_train_count Number of trains per server
# TYPE smo_train_count gauge
${Array.from(
  trainFetcher.currentData?.entries() || [],
  ([server, trains]) => `smo_train_count{server="${server}"} ${trains.length}`
).join("\n")}

# HELP smo_player_train_count Number of trains controlled by a player per server
# TYPE smo_player_train_count gauge
${Array.from(
  trainFetcher.currentData?.entries() || [],
  ([server, trains]) =>
    `smo_player_train_count{server="${server}"} ${
      trains.filter((train) => train.TrainData.ControlledBySteamID).length
    }`
).join("\n")}

# HELP smo_train_avg_speed Average speed of trains per server
# TYPE smo_train_avg_speed gauge
${Array.from(
  trainFetcher.currentData?.entries() || [],
  ([server, trains]) =>
    `smo_train_avg_speed{server="${server}"} ${
      trains.reduce((prev, curr) => prev + curr.TrainData.Velocity, 0) / trains.length
    }`
).join("\n")}

# HELP smo_station_count Number of stations per server
# TYPE smo_station_count gauge
${Array.from(
  stationFetcher.currentData?.entries() || [],
  ([server, stations]) => `smo_station_count{server="${server}"} ${stations.length}`
).join("\n")}

# HELP smo_player_station_count Number of stations controlled by a player per server
# TYPE smo_player_station_count gauge
${Array.from(
  stationFetcher.currentData?.entries() || [],
  ([server, stations]) =>
    `smo_player_station_count{server="${server}"} ${
      stations.filter((station) => station.DispatchedBy?.[0]?.SteamId).length
    }`
).join("\n")}

# HELP smo_server_timezone Timezone on each server
# TYPE smo_server_timezone gauge
${Array.from(
  timeFetcher.currentData?.entries() || [],
  ([server, time]) => `smo_server_timezone{server="${server}"} ${time.timezone}`
).join("\n")}

# HELP smo_server_status Server status (active/inactive)
# TYPE smo_server_status gauge
${Array.from(
  serverFetcher.currentData?.values() || [],
  (status) =>
    `smo_server_status{server="${status.ServerCode}",region="${status.ServerRegion}",name="${
      status.ServerName
    }"} ${status.IsActive ? 1 : 0}`
).join("\n")}

# HELP smo_server_punctuality Punctuality of each server
# TYPE smo_server_punctuality gauge
${Array.from(serverFetcher.currentData?.values() || [], (status) => [
  status.ServerCode,
  getServerPunctuality(status.ServerCode) || 0,
])
  .filter((x) => x[1] !== null)
  .map(([server, p]) => `smo_server_punctuality{server="${server}"} ${p}`)
  .join("\n")}
`.trim()
  );
});

if (process.env.ADMIN_PASSWORD) {
  async function sendUpdatedSignals() {
    for (const [server, trains] of trainFetcher.currentData || []) {
      const signals = await getSignalsForTrains(trains);

      io.to(server).emit("signals", signals);
    }
  }

  app.use("/signals", express.json(), (req, res, next) => {
    if (req.body?.password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    next();
  });

  app.patch("/signals/:signal", async (req, res) => {
    const { type, role, prevFinalized, nextFinalized } = req.body || {};

    if (
      !req.params?.signal ||
      (!type && !role && prevFinalized === undefined && nextFinalized === undefined)
    ) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;

    if (!(await checkSignalExists(signal))) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    if (await updateSignal(signal, { type, role, prevFinalized, nextFinalized })) {
      res.json({ success: true });
      sendUpdatedSignals();
    } else {
      res.status(500).json({ error: "Failed to set signal type" });
    }
  });

  app.delete("/signals/:signal", async (req, res) => {
    if (!req.params?.signal) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;

    if (!(await checkSignalExists(signal))) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    if (await deleteSignal(signal)) {
      res.json({ success: true });
      sendUpdatedSignals();
    } else {
      res.status(500).json({ error: "Failed to remove signal" });
    }
  });

  app.delete("/signals/:signal/prev", async (req, res) => {
    if (!req.params?.signal || !req.body?.prevSignal) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;
    const { prevSignal } = req.body;

    if (!(await checkSignalExists(signal))) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    if (!(await checkSignalExists(prevSignal))) {
      res.status(404).json({ error: "Previous signal not found" });
      return;
    }

    if (await removeSignalPrevSignal(signal, prevSignal)) {
      res.json({ success: true });
      sendUpdatedSignals();
    } else {
      res.status(500).json({ error: "Failed to remove prev signal" });
    }
  });

  app.delete("/signals/:signal/next", async (req, res) => {
    if (!req.params?.signal || !req.body?.nextSignal) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;
    const { nextSignal } = req.body;

    const signalData = await getSignal(signal);

    if (!signalData) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    if (!signalData.nextSignals.includes(nextSignal)) {
      logger.debug(
        `Signal ${signal} does not have next signal ${nextSignal}: ${JSON.stringify(signalData)}`
      );
      res.status(404).json({ error: "Next signal not found" });
      return;
    }

    if (await removeSignalNextSignal(signal, nextSignal)) {
      res.json({ success: true });
      sendUpdatedSignals();
    } else {
      res.status(500).json({ error: "Failed to remove next signal" });
    }
  });

  app.post("/signals/:signal/prev", async (req, res) => {
    if (!req.params?.signal || !req.body?.prevSignal) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;
    const { prevSignal } = req.body;

    if (!(await checkSignalExists(signal))) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    if (!(await checkSignalExists(prevSignal))) {
      res.status(404).json({ error: "Previous signal not found" });
      return;
    }

    if (await addSignalPrevSignal(signal, prevSignal)) {
      res.json({ success: true });
      sendUpdatedSignals();
    } else {
      res.status(500).json({ error: "Failed to add prev signal" });
    }
  });

  app.post("/signals/:signal/next", async (req, res) => {
    if (!req.params?.signal || !req.body?.nextSignal) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;
    const { nextSignal } = req.body;

    if (!(await checkSignalExists(signal))) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    if (!(await checkSignalExists(nextSignal))) {
      res.status(404).json({ error: "Next signal not found" });
      return;
    }

    if (await addSignalNextSignal(signal, nextSignal)) {
      res.json({ success: true });
      sendUpdatedSignals();
    } else {
      res.status(500).json({ error: "Failed to add next signal" });
    }
  });
}

Sentry.setupExpressErrorHandler(app);

const PORT = process.env.PORT || 3000;

webServer.listen(PORT, () => {
  logger.info(`Listening on http://localhost:${PORT}`);
});
