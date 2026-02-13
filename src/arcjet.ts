import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";
import type { NextFunction, Request, Response } from "express";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey) {
  throw new Error("Missing environment variable 'ARCJET_KEY'");
}

export const httpArcjet = arcjet({
  key: arcjetKey,
  rules: [
    shield({ mode: arcjetMode }),
    detectBot({ mode: arcjetMode, allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"] }),
    slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 }),
  ],
});

export const wsArcjet = arcjet({
  key: arcjetKey,
  rules: [
    shield({ mode: arcjetMode }),
    detectBot({ mode: arcjetMode, allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"] }),
    slidingWindow({ mode: arcjetMode, interval: "2s", max: 5 }),
  ],
});

export async function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!httpArcjet) return next();

  try {
    const decision = await httpArcjet.protect(req);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return res.status(429).json({ error: "Too many requests" });
      }

      return res.status(403).json({ error: "Forbidden" });
    }
  } catch (err) {
    console.error("Arcjet Middleware Error:", err);
    return res.status(503).json({ error: "Service unavailable" });
  }

  next();
}
