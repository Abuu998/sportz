import "ws";
import { WebSocket, WebSocketServer, type Server } from "ws";
import type { Match } from "@/db/schema";
import type { Server as HTTPServer } from "http";
import { wsArcjet } from "@/arcjet";

declare module "ws" {
  interface WebSocket {
    isAlive: boolean;
  }
}

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

  server.on("upgrade", async (req, socket, head) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          // const code = decision.reason.isRateLimit() ? 1013 : 1008;
          if (decision.reason.isRateLimit()) {
            socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
          } else {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          }

          socket.destroy();
          return;
        }
      } catch (err) {
        console.error("WebSocket upgrade protection error", err);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }

      ws.handleUpgrade(req, socket, head, (ws) => {
        ws.emit("connection", ws, req);
      });
    }
  });

  ws.on("connection", async (socket, req) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    sendJSON(socket, { type: "welcome", message: "Welcome to the WebSocket server!" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    ws.clients.forEach((w) => {
      if (w.isAlive === false) {
        w.terminate();
      } else {
        w.isAlive = false;
        w.ping();
      }
    });
  }, 30000);

  ws.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match: Match) {
    broadcast(ws, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
