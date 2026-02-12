import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.static("."));

const rooms = new Map();
const PLAYER_ORDER = ["red", "blue"];

function generateCode() {
  let code = "";
  while (!code || rooms.has(code)) {
    code = String(Math.floor(100000 + Math.random() * 900000));
  }
  return code;
}

function getRoom(code) {
  return rooms.get(code);
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ modeKey }) => {
    const code = generateCode();
    const room = {
      code,
      modeKey: modeKey || "hvh2",
      players: [],
      state: null,
    };
    rooms.set(code, room);
    socket.join(code);
    const playerId = PLAYER_ORDER[0];
    room.players.push({ socketId: socket.id, playerId });
    socket.emit("room:joined", {
      code,
      playerId,
      isHost: true,
      state: room.state,
    });
  });

  socket.on("room:join", ({ code }) => {
    const room = getRoom(code);
    if (!room) {
      socket.emit("room:error", { message: "Room not found" });
      return;
    }
    if (room.players.length >= PLAYER_ORDER.length) {
      socket.emit("room:error", { message: "Room is full" });
      return;
    }
    socket.join(code);
    const playerId = PLAYER_ORDER[room.players.length];
    room.players.push({ socketId: socket.id, playerId });
    socket.emit("room:joined", {
      code,
      playerId,
      isHost: false,
      state: room.state,
    });
    socket.to(code).emit("room:status", { message: `${playerId} joined` });
    io.to(room.players[0].socketId).emit("room:sync");
  });

  socket.on("room:leave", ({ code }) => {
    const room = getRoom(code);
    if (!room) return;
    room.players = room.players.filter((p) => p.socketId !== socket.id);
    socket.leave(code);
    if (room.players.length === 0) {
      rooms.delete(code);
    }
  });

  socket.on("room:state", ({ code, state }) => {
    const room = getRoom(code);
    if (!room) return;
    room.state = state;
    socket.to(code).emit("room:state", { state });
  });

  socket.on("room:action", ({ code, action }) => {
    const room = getRoom(code);
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    const host = room.players[0];
    if (!host) return;
    io.to(host.socketId).emit("room:action", {
      playerId: player.playerId,
      action,
    });
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms.entries()) {
      const before = room.players.length;
      room.players = room.players.filter((p) => p.socketId !== socket.id);
      if (room.players.length !== before) {
        socket.to(code).emit("room:status", { message: "A player left" });
      }
      if (room.players.length === 0) {
        rooms.delete(code);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
