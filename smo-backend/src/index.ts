if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

import * as Sentry from "@sentry/node";
import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import {
  getServerCodes,
  getServerData,
  getServerStatus,
  getTimetableForTrain,
  onAllDataRefreshed,
  onDataRefreshed,
  onServerDataRefreshed,
  refreshData,
} from "./data-fetcher";
import logger from "./logger";
import { analyzeTrains, getSignals, getSignalsForTrains } from "./analytics/signal";
import { analyzeTrainsForRoutes, getRoutePoints } from "./analytics/route";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

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

refreshData(io);

let connectedClients = 0;

io.on("connection", (socket) => {
  logger.info(`Client connected, total: ${++connectedClients}`, {
    client: socket.id,
  });

  socket.emit("servers", getServerStatus());

  socket.on("switch-server", (room, cb) => {
    logger.info(`Switching to server ${room}.`, { client: socket.id });

    if (socket.data.serverCode) {
      socket.leave(socket.data.serverCode);
    }

    socket.join(room);
    socket.data.serverCode = room;

    cb?.(true);

    const data = getServerData(room);

    if (data) {
      socket.emit("data", { ...data, timeTables: undefined });
    } else {
      logger.warn(`No data found for server ${room}!`, { client: socket.id });
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
      const timetable = getTimetableForTrain(socket.data.serverCode, train);
      cb?.(timetable);
    } else {
      cb?.(null);
    }
  });

  socket.on("get-train-route-points", (trainRoute: string | null, cb) => {
    if (trainRoute) {
      const route = getRoutePoints(trainRoute);
      cb?.(route);
    } else {
      cb?.(null);
    }
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected, total: ${--connectedClients}`, { client: socket.id });
  });
});

onServerDataRefreshed((servers) => {
  io.emit("servers", servers);
});

onDataRefreshed((server, data) => {
  io.to(server).emit("data", {
    ...data,
    timeTables: undefined,
    signals: getSignalsForTrains(data.trains),
  });
});

onAllDataRefreshed((data) => {
  const trains = Array.from(data.values()).flatMap(({ trains }) => trains);
  logger.debug(`There are ${trains.length} trains in total.`);
  analyzeTrains(trains);

  if ((io.sockets.adapter.rooms.get("signals")?.size || 0) > 0) {
    io.to("signals").emit("signals", getSignals());
  }

  analyzeTrainsForRoutes(trains);
});

app.get("/status", (_req, res) => {
  res.json({
    connectedClients,
    servers: getServerCodes().map((serverCode) => ({
      serverCode,
      connectedClients: io.sockets.adapter.rooms.get(serverCode)?.size || 0,
    })),
  });
});

// The error handler must be registered before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
