import { db } from "@/db";
import { matches, type Match, type NewMatch } from "@/db/schema";
import { getMatchStatus } from "@/utils/match-status";
import {
  createMatchSchema,
  listMatchesQuerySchema,
  type MatchStatus,
} from "@/validations/matches";
import { desc } from "drizzle-orm";
import { Router } from "express";

export const matchesRouter = Router();
const MAX_LIMIT = 100;

matchesRouter
  .get("/", async (req, res) => {
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success || !parsed.data)
      return res
        .status(400)
        .json({ error: "Invalid request data", details: parsed.error.issues });

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

    try {
      const data = (await db.query.matches.findMany({
        limit,
        orderBy: desc(matches.createdAt),
      })) as Match[];
      return res.status(200).json({ data });
    } catch (err) {
      return res.status(500).json({ error: "Failed to list matches." });
    }
  })
  .post("/", async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);
    const { data } = parsed;

    if (!parsed.success || !parsed.data)
      return res.status(400).json({ error: "Invalid data", details: parsed.error.issues });

    const dataValues: NewMatch = {
      ...data,
      startTime: new Date(data!.startTime),
      endTime: new Date(data!.endTime),
      homeScore: (data!.homeScore as number) || 0,
      awayScore: (data!.awayScore as number) || 0,
      status: getMatchStatus(data!.startTime, data!.endTime) as MatchStatus,
    } as NewMatch;

    try {
      const [event] = await db.insert(matches).values(dataValues).returning();
      return res.status(201).json({ data: event });
    } catch (err) {
      return res.status(500).json({ error: "Failed to create match." });
    }
  });
