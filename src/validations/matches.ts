import { z } from "zod";

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
} as const;

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const matchIdParamSchema = z.object({
  id: z.uuid({ version: "v4" }),
});

const isValidIsoString = (value: string) => {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  return typeof value === "string" && isoRegex.test(value) && !Number.isNaN(Date.parse(value));
};

export const createMatchSchema = z
  .object({
    sport: z.string().min(1, { message: "sport is required" }),
    homeTeam: z.string().min(1, { message: "homeTown is required" }),
    awayTeam: z.string().min(1, { message: "awayTeam is required" }),
    startTime: z.iso.datetime({ message: "startTime must be a valid ISO date string" }),
    endTime: z.iso.datetime({ message: "endTime must be a valid ISO date string" }),
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const start = Date.parse(data.startTime);
    const end = Date.parse(data.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return;
    }
    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTime must be after startTime",
        path: ["endTime"],
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
