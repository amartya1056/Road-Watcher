import { pgTable, text, serial, real, boolean, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const potholesTable = pgTable("potholes", {
  id: uuid("id").primaryKey().defaultRandom(),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  severity: text("severity").notNull().default("Low"),
  depth_cm: real("depth_cm").notNull(),
  width_cm: real("width_cm").notNull(),
  volume_m3: real("volume_m3").notNull(),
  estimated_repair_cost_usd: real("estimated_repair_cost_usd").notNull(),
  image_base64: text("image_base64"),
  is_fixed: boolean("is_fixed").notNull().default(false),
  votes: integer("votes").notNull().default(0),
  confidence: real("confidence").notNull().default(0.85),
  address: text("address"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertPotholeSchema = createInsertSchema(potholesTable).omit({ id: true, timestamp: true, votes: true, is_fixed: true });
export type InsertPothole = z.infer<typeof insertPotholeSchema>;
export type Pothole = typeof potholesTable.$inferSelect;
