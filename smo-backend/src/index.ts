if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { getServerCodes, getServerData, onDataRefreshed, refreshData } from "./data-fetcher";
import logger from "./logger";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
  },
});

refreshData();

let connectedClients = 0;

io.on("connection", (socket) => {
  logger.info(`Client connected, total: ${++connectedClients}`, {
    client: socket.id,
  });

  socket.emit("servers", getServerCodes());

  socket.on("switch-server", (room, cb) => {
    logger.info(`Switching to server ${room}.`, { client: socket.id });

    if (socket.data.serverCode) {
      socket.leave(socket.data.serverCode);
    }

    socket.join(room);
    socket.data.serverCode = room;

    cb(true);

    const data = getServerData(room);

    if (data) {
      socket.emit("data", data);
    } else {
      logger.warn(`No data found for server ${room}!`, { client: socket.id });
    }
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected, total: ${--connectedClients}`, { client: socket.id });
  });
});

onDataRefreshed((data) => {
  io.emit("servers", Array.from(data.keys()));
  for (const [serverCode, { trains, stations, lastUpdated }] of data.entries()) {
    io.to(serverCode).emit("data", { trains, stations, lastUpdated });
  }
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
