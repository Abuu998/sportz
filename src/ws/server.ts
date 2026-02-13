import { type WebSocket, WebSocketServer, type Server } from "ws";
import type { Match } from "@/db/schema";
import type { Server as HTTPServer } from "http";

function sendJSON<T>(socket: WebSocket, payload: T) {
  if (!socket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcast<T>(ws: Server, payload: T) {
  for (const client of ws.clients) {
    if (!client.OPEN) return;

    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server: HTTPServer) {
  const ws = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  ws.on("connection", (socket) => {
    sendJSON(socket, { type: "welcome", message: "Welcome to the WebSocket server!" });

    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match: Match) {
    broadcast(ws, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
