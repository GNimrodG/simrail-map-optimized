if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

import * as Sentry from "@sentry/node";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import logger from "./logger";
import {
  analyzeTrains,
  getSignal,
  getSignals,
  getSignalsForTrains,
  removeSignalPrevSignal,
  setSignalType,
} from "./analytics/signal";
import { analyzeTrainsForRoutes, getRoutePoints } from "./analytics/route";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { serverFetcher } from "./fetchers/sever-fetcher";
import { stationFetcher } from "./fetchers/station-fetcher";
import { trainFetcher } from "./fetchers/train-fetcher";
import { timeFetcher } from "./fetchers/time-fetcher";
import { timetableFetcher } from "./fetchers/timetable-fetcher";
import { filter, take } from "rxjs";

const app = express();

Sentry.init({
  dsn: "https://9a17f501f8e2c7f28b08fd08a925dd8f@o260759.ingest.us.sentry.io/4507205518295040",
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Sentry.Integrations.Express({ app }),
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());

// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
  },
});

serverFetcher.start();
serverFetcher.data$
  .pipe(
    filter((x) => !!x),
    take(1)
  )
  .subscribe((data) => {
    logger.info(
      "Initial server data fetched, starting other fetchers. Server count: " + data!.length
    );
    trainFetcher.start();
    stationFetcher.start();
    timeFetcher.start();
    timetableFetcher.start();
  });

let connectedClients = 0;

io.on("connection", (socket) => {
  logger.info(
    `Client connected from ${
      socket.handshake.headers["x-forwarded-for"]?.toString().split(",")?.[0] ||
      socket.handshake.address
    }, total clients: ${++connectedClients}`,
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

  socket.on("join-signals", () => {
    logger.info("Joining signals room.", { client: socket.id });
    socket.join("signals");
  });

  socket.on("leave-signals", () => {
    logger.info("Leaving signals room.", { client: socket.id });
    socket.leave("signals");
  });

  socket.on("get-train-timetable", (train: string | null, cb) => {
    if (train) {
      const timetable = timetableFetcher.getTimeTableForTrain(socket.data.serverCode, train);
      cb?.(timetable);
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

  socket.on("disconnect", () => {
    logger.info(`Client disconnected, total: ${--connectedClients}`, { client: socket.id });
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
});

timeFetcher.perServerData$.subscribe((data) => {
  io.to(data.server).emit("time", data.data);
});

trainFetcher.data$.subscribe(async (data) => {
  if (!data) return;

  const trains = Array.from(data.values()).flatMap((trains) => trains);
  logger.debug(`There are ${trains.length} trains in total.`);

  if (!process.env.DISABLE_SIGNAL_ANALYSIS) {
    analyzeTrains(trains);
  }

  if (!process.env.DISABLE_ROUTE_ANALYSIS) {
    analyzeTrainsForRoutes(trains);
  }

  if ((io.sockets.adapter.rooms.get("signals")?.size || 0) > 0) {
    io.to("signals").emit("signals", await getSignals());
  }
});

app.get("/status", (_req, res) => {
  res.json({
    connectedClients,
    servers: serverFetcher.currentData?.reduce<Record<string, number>>((prev, curr) => {
      prev[curr.ServerCode] = io.sockets.adapter.rooms.get(curr.ServerCode)?.size || 0;
      return prev;
    }, {}),
  });
});

// Prometheus metrics
app.get("/metrics", (_req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8; escaping=values");
  res.send(
    `
# HELP smo_connected_clients Number of connected clients
# TYPE smo_connected_clients gauge
smo_connected_clients ${connectedClients}

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
${Array.from(trainFetcher.currentData?.entries() || [])
  ?.map(([server, trains]) => `smo_train_count{server="${server}"} ${trains.length}`)
  .join("\n")}
  
# HELP smo_player_train_count Number of trains controlled by a player per server
# TYPE smo_player_train_count gauge
${Array.from(trainFetcher.currentData?.entries() || [])
  ?.map(
    ([server, trains]) =>
      `smo_player_train_count{server="${server}"} ${
        trains.filter((train) => train.TrainData.ControlledBySteamID).length
      }`
  )
  .join("\n")}
  
# HELP smo_train_avg_speed Average speed of trains per server
# TYPE smo_train_avg_speed gauge
${Array.from(trainFetcher.currentData?.entries() || [])
  ?.map(
    ([server, trains]) =>
      `smo_train_avg_speed{server="${server}"} ${
        trains.reduce((prev, curr) => prev + curr.TrainData.Velocity, 0) / trains.length
      }`
  )
  .join("\n")}

# HELP smo_station_count Number of stations per server
# TYPE smo_station_count gauge
${Array.from(stationFetcher.currentData?.entries() || [])
  ?.map(([server, stations]) => `smo_station_count{server="${server}"} ${stations.length}`)
  .join("\n")}
  
# HELP smo_player_station_count Number of stations controlled by a player per server
# TYPE smo_player_station_count gauge
${Array.from(stationFetcher.currentData?.entries() || [])
  ?.map(
    ([server, stations]) =>
      `smo_player_station_count{server="${server}"} ${
        stations.filter((station) => station.DispatchedBy?.[0]?.SteamId).length
      }`
  )
  .join("\n")}

# HELP smo_server_timezone Timezone on each server
# TYPE smo_server_timezone gauge
${Array.from(timeFetcher.currentData?.entries() || [])
  ?.map(([server, time]) => `smo_server_timezone{server="${server}"} ${time.timezone}`)
  .join("\n")}
  
# HELP smo_server_name Server name
# TYPE smo_server_name gauge
${Array.from(serverFetcher.currentData?.values() || [])
  ?.map((status) => `smo_server_name{server="${status.ServerCode}"} ${status.ServerName}`)
  .join("\n")}
  
# HELP smo_server_region Server region
# TYPE smo_server_region gauge
${Array.from(serverFetcher.currentData?.values() || [])
  ?.map((status) => `smo_server_region{server="${status.ServerCode}"} ${status.ServerRegion}`)
  .join("\n")}

# HELP smo_server_name Server name
# TYPE smo_server_name gauge
${Array.from(serverFetcher.currentData?.values() || [])
  ?.map((status) => `smo_server_name{server="${status.ServerCode}"} ${status.ServerName}`)
  .join("\n")}

# HELP smo_server_is_active Server is active
# TYPE smo_server_is_active gauge
${Array.from(serverFetcher.currentData?.values() || [])
  ?.map(
    (status) => `smo_server_is_active{server="${status.ServerCode}"} ${status.IsActive ? 1 : 0}`
  )
  .join("\n")}
  `.trim()
  );
});

if (process.env.ADMIN_PASSWORD) {
  app.patch("/signals/:signal", express.json(), (req, res) => {
    if (req.body?.password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.params?.signal || !req.body?.type) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;
    const { type } = req.body;

    setSignalType(signal, type);
    res.json({ success: true });
  });

  app.delete("/signal/:signal/prev", express.json(), async (req, res) => {
    if (req.body?.password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.params?.signal || !req.body?.prevSignal) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;
    const { prevSignal } = req.body;

    const signalData = await getSignal(signal);

    if (!signalData) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    removeSignalPrevSignal(signal, prevSignal);

    res.json({ success: true });
  });

  app.delete("/signals/:signal/next", express.json(), async (req, res) => {
    if (req.body?.password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

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
      res.status(404).json({ error: "Next signal not found" });
      return;
    }

    removeSignalPrevSignal(signal, nextSignal);

    res.json({ success: true });
  });

  app.post("/signal/:signal/prev", express.json(), async (req, res) => {
    if (req.body?.password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.params?.signal || !req.body?.prevSignal) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const { signal } = req.params;
    const { prevSignal } = req.body;

    const signalData = await getSignal(signal);

    if (!signalData) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    const prevSignalData = await getSignal(prevSignal);

    if (!prevSignalData) {
      res.status(404).json({ error: "Previous signal not found" });
      return;
    }

    removeSignalPrevSignal(signal, prevSignal);

    res.json({ success: true });
  });

  app.post("/signals/:signal/next", express.json(), async (req, res) => {
    if (req.body?.password !== process.env.ADMIN_PASSWORD) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

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

    const nextSignalData = await getSignal(nextSignal);

    if (!nextSignalData) {
      res.status(404).json({ error: "Next signal not found" });
      return;
    }

    removeSignalPrevSignal(signal, nextSignal);

    res.json({ success: true });
  });
}

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
