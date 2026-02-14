import { generateId } from "@/lib/utils";
import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const matchStatus = pgEnum("match_status", ["scheduled", "live", "finished"]);

export const matches = pgTable("matches", {
  id: text("id").primaryKey().$default(generateId),
  sport: text("sport").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  status: matchStatus("status").notNull().default("scheduled"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commentaries = pgTable("commentaries", {
  id: text("id").primaryKey().$default(generateId),
  matchId: text("match_id")
    .notNull()
    .references(() => matches.id),
  minute: integer("minute"),
  sequence: integer("sequence"),
  period: text("period"),
  eventType: text("event_type"),
  actor: text("actor"),
  team: text("team"),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const matchesRelations = relations(matches, ({ many }) => ({
  commentaries: many(commentaries),
}));

export const commentariesRelations = relations(commentaries, ({ one }) => ({
  match: one(matches, {
    fields: [commentaries.matchId],
    references: [matches.id],
  }),
}));

/** Type exports for type-safe queries */
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Commentary = typeof commentaries.$inferSelect;
export type NewCommentary = typeof commentaries.$inferInsert;
