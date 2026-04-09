import { Router } from "express";
import { db, complaintsTable } from "../db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/potholes/:id/complaints", async (req, res) => {
  const { id } = req.params;
  const rows = await db.select().from(complaintsTable).where(eq(complaintsTable.pothole_id, id));
  return res.json(rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() })));
});

router.post("/potholes/:id/complaints", async (req, res) => {
  const { id } = req.params;
  const { type, road_type, authority, description, contact_name, contact_email } = req.body;

  if (!type || !road_type || !authority || !description) {
    return res.status(400).json({ error: "Missing required fields: type, road_type, authority, description" });
  }

  const [created] = await db.insert(complaintsTable).values({
    pothole_id: id,
    type: type as any,
    road_type: road_type as any,
    authority,
    description,
    contact_name: contact_name ?? null,
    contact_email: contact_email ?? null,
  }).returning();

  return res.status(201).json({ ...created, created_at: created.created_at.toISOString() });
});

export default router;
