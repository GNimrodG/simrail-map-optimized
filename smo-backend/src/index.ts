if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

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

const app = express();
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

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
