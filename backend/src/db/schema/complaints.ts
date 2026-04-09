import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { potholesTable } from "./potholes";

export const roadTypeEnum = pgEnum("road_type", ["NH", "SH", "MDR", "City Road", "Rural Road", "Unknown"]);
export const complaintStatusEnum = pgEnum("complaint_status", ["pending", "forwarded", "resolved"]);
export const complaintTypeEnum = pgEnum("complaint_type", ["complaint", "report"]);

export const complaintsTable = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  pothole_id: uuid("pothole_id").notNull().references(() => potholesTable.id, { onDelete: "cascade" }),
  type: complaintTypeEnum("type").notNull().default("complaint"),
  road_type: roadTypeEnum("road_type").notNull().default("Unknown"),
  authority: text("authority").notNull(),
  description: text("description").notNull(),
  contact_name: text("contact_name"),
  contact_email: text("contact_email"),
  status: complaintStatusEnum("status").notNull().default("pending"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const insertComplaintSchema = createInsertSchema(complaintsTable).omit({ id: true, created_at: true, status: true });
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Complaint = typeof complaintsTable.$inferSelect;
