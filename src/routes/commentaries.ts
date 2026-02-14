import { db } from "@/db";
import { commentaries, type NewCommentary } from "@/db/schema";
import { listCommentaryQuerySchema, createCommentarySchema } from "@/validations/commentary";
import { matchIdParamSchema } from "@/validations/matches";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";

const MAX_LIMIT = 100;

const commentaryRouter = Router({ mergeParams: true });

commentaryRouter
  .get("/", async (req, res) => {
    const parsed = listCommentaryQuerySchema.safeParse(req.query);
    if (!parsed.success || !parsed.data)
      return res
        .status(400)
        .json({ error: "Invalid request data", details: parsed.error.issues });

    const parsedParams = matchIdParamSchema.safeParse(req.params);
    if (!parsedParams.success || !parsedParams.data)
      return res
        .status(400)
        .json({ error: "Invalid params", details: parsedParams.error.issues });

    const { id: matchId } = parsedParams.data;
    const { limit = 10 } = parsed.data;
    const safeLimit = Math.min(limit, MAX_LIMIT);

    try {
      const data = await db.query.commentaries.findMany({
        where: eq(commentaries.matchId, matchId),
        orderBy: desc(commentaries.createdAt),
        limit: safeLimit,
      });
      return res.status(200).json({ data });
    } catch (err) {
      return res.status(500).json({ error: "Failed to list commentary." });
    }
  })
  .post("/", async (req, res) => {
    const parsedParams = matchIdParamSchema.safeParse(req.params);
    if (!parsedParams.success || !parsedParams.data)
      return res
        .status(400)
        .json({ error: "Invalid params", details: parsedParams.error.issues });

    const parsedBody = createCommentarySchema.safeParse(req.body);
    if (!parsedBody.success || !parsedBody.data)
      return res.status(400).json({ error: "Invalid data", details: parsedBody.error.issues });

    const { minute, ...restBody } = parsedBody.data;

    const dataValues: NewCommentary = {
      matchId: parsedParams.data.id,
      minute,
      ...restBody,
    } as NewCommentary;

    try {
      const [commentary] = await db.insert(commentaries).values(dataValues).returning();

      if (res.app.locals.broadcastCommentary) {
        res.app.locals.broadcastCommentary(commentary?.matchId, commentary);
      }

      return res.status(201).json({ data: commentary });
    } catch (err) {
      return res.status(500).json({ error: "Failed to create commentary." });
    }
  });

export { commentaryRouter };
