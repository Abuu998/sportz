import "ws";
import { WebSocket, WebSocketServer, type Server } from "ws";
import type { Commentary, Match } from "@/db/schema";
import type { Server as HTTPServer } from "http";
import { wsArcjet } from "@/arcjet";

declare module "ws" {
  interface WebSocket {
    isAlive: boolean;
    subscriptions: Set<string>;
  }
}

interface BroadCastPayload<T> {
  type: string;
  data: T;
  [key: string]: unknown;
}

const matchSubscribers = new Map<string, Set<WebSocket>>();

function subscribe(matchId: string, socket: WebSocket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId)?.add(socket);
}

function unsubscribe(matchId: string, socket: WebSocket) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptions(socket: WebSocket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId as string, socket);
  }
}

function handleMessage<T>(socket: WebSocket, data: T) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch (err) {
    sendJSON(socket, { type: "error", message: "Invalid JSON" });
  }

  if (message?.type === "subscribe" && message.matchId) {
    subscribe(message.matchId as string, socket);
    socket.subscriptions.add(message.matchId);
    sendJSON(socket, { type: "subscribed", matchId: message.matchId });
    return;
  }

  if (message?.type === "unsubscribe" && message.matchId) {
    unsubscribe(message.matchId as string, socket);
    socket.subscriptions.delete(message.matchId);
    sendJSON(socket, { type: "unsubscribed", matchId: message.matchId });
    return;
  }
}

function broadCastToMatch<T>(matchId: string, payload: BroadCastPayload<T>) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  for (const client of subscribers) {
    sendJSON(client, payload);
  }
}

function sendJSON<T>(socket: WebSocket, payload: T) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll<T>(ws: Server, payload: BroadCastPayload<T>) {
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
    const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

    if (pathname !== "/ws") {
      return;
    }

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

      ws.handleUpgrade(req, socket, head, (wsClient) => {
        ws.emit("connection", wsClient, req);
      });
    }
  });

  ws.on("connection", async (socket, req) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.subscriptions = new Set();
    sendJSON(socket, { type: "welcome", message: "Welcome to the WebSocket server!" });

    socket.on("message", (data) => {
      handleMessage(socket, data);
    });

    socket.on("close", () => {
      cleanupSubscriptions(socket);
    });
    socket.on("error", socket.terminate);
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
    broadcastToAll(ws, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId: string, comment: Commentary) {
    broadCastToMatch(matchId, { type: "commentary", data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
