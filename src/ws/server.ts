import { WebSocket, WebSocketServer, type Server } from "ws";
import type { Match } from "@/db/schema";
import type { Server as HTTPServer } from "http";

function sendJSON<T>(socket: WebSocket, payload: T) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast<T>(ws: Server, payload: T) {
  const message = JSON.stringify(payload);
  for (const client of ws.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(message);
  }
}

export function attachWebSocketServer(server: HTTPServer) {
  const ws = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  ws.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    sendJSON(socket, { type: "welcome", message: "Welcome to the WebSocket server!" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    ws.clients.forEach((w) => {
      if (w.isAlive === false) return w.terminate();

      w.isAlive = false;
      w.ping();
    });
  }, 30000);

  ws.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match: Match) {
    broadcast(ws, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
