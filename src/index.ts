import express from "express";
import http from "http";
import { matchesRouter } from "./routes/matches";
import { attachWebSocketServer } from "./ws/server";
import { securityMiddleware } from "./arcjet";

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const httpServer = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ message: "Hello from Sportz!" });
});

app.use(securityMiddleware);
app.use("/api/matches", matchesRouter);

const { broadcastMatchCreated } = attachWebSocketServer(httpServer);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

httpServer.listen(Number(PORT), HOST, () => {
  const baseUrl = HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket server is running on ${baseUrl.replace("http", "ws")}/ws`);
});
