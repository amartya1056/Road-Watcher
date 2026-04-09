import { Router } from "express";
import { db, potholesTable } from "../db";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import {
  ListPotholesQueryParams,
  CreatePotholeBody,
  GetPotholeParams,
  UpdatePotholeParams,
  UpdatePotholeBody,
  VotePotholeParams,
} from "../zod/api";

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RoadviewApp/1.0 (pothole-intelligence-platform)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const a = data.address || {};
    const parts = [
      a.road || a.pedestrian || a.footway || a.path,
      a.suburb || a.neighbourhood || a.quarter,
      a.city || a.town || a.village || a.municipality,
      a.country,
    ].filter(Boolean);
    return parts.slice(0, 3).join(", ") || data.display_name?.split(",").slice(0, 3).join(",") || null;
  } catch {
    return null;
  }
}

const router = Router();

function getDateFilter(dateRange?: string) {
  if (!dateRange || dateRange === "all") return undefined;
  const now = new Date();
  if (dateRange === "24h") {
    now.setHours(now.getHours() - 24);
  } else if (dateRange === "week") {
    now.setDate(now.getDate() - 7);
  } else if (dateRange === "month") {
    now.setDate(now.getDate() - 30);
  }
  return now;
}

router.get("/potholes", async (req, res) => {
  const parsed = ListPotholesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query params" });
  }

  const { severity, dateRange, is_fixed } = parsed.data;
  const conditions = [];

  if (severity) {
    conditions.push(eq(potholesTable.severity, severity));
  }

  if (typeof is_fixed !== "undefined") {
    const fixedVal = String(is_fixed) === "true";
    conditions.push(eq(potholesTable.is_fixed, fixedVal));
  }

  const dateFilter = getDateFilter(dateRange);
  if (dateFilter) {
    conditions.push(gte(potholesTable.timestamp, dateFilter));
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(potholesTable)
          .where(and(...conditions))
          .orderBy(desc(potholesTable.timestamp))
      : await db
          .select()
          .from(potholesTable)
          .orderBy(desc(potholesTable.timestamp));

  return res.json(
    rows.map((r) => ({ ...r, timestamp: r.timestamp.toISOString() }))
  );
});

router.post("/potholes", async (req, res) => {
  const parsed = CreatePotholeBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const address = parsed.data.address ?? await reverseGeocode(parsed.data.lat, parsed.data.lon);

  const [created] = await db
    .insert(potholesTable)
    .values({
      lat: parsed.data.lat,
      lon: parsed.data.lon,
      severity: parsed.data.severity,
      depth_cm: parsed.data.depth_cm,
      width_cm: parsed.data.width_cm,
      volume_m3: parsed.data.volume_m3,
      estimated_repair_cost_usd: parsed.data.estimated_repair_cost_usd,
      image_base64: parsed.data.image_base64 ?? null,
      confidence: parsed.data.confidence,
      address,
    })
    .returning();

  return res.status(201).json({ ...created, timestamp: created.timestamp.toISOString() });
});

router.get("/potholes/:id", async (req, res) => {
  const parsed = GetPotholeParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid params" });
  }

  const [row] = await db
    .select()
    .from(potholesTable)
    .where(eq(potholesTable.id, parsed.data.id));

  if (!row) return res.status(404).json({ error: "Pothole not found" });

  return res.json({ ...row, timestamp: row.timestamp.toISOString() });
});

router.patch("/potholes/:id", async (req, res) => {
  const paramsParsed = UpdatePotholeParams.safeParse(req.params);
  if (!paramsParsed.success) {
    return res.status(400).json({ error: "Invalid params" });
  }

  const bodyParsed = UpdatePotholeBody.safeParse(req.body);
  if (!bodyParsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof bodyParsed.data.is_fixed !== "undefined")
    updateData.is_fixed = bodyParsed.data.is_fixed;
  if (bodyParsed.data.severity) updateData.severity = bodyParsed.data.severity;

  const [updated] = await db
    .update(potholesTable)
    .set(updateData)
    .where(eq(potholesTable.id, paramsParsed.data.id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Pothole not found" });

  return res.json({ ...updated, timestamp: updated.timestamp.toISOString() });
});

router.post("/potholes/:id/vote", async (req, res) => {
  const parsed = VotePotholeParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid params" });
  }

  const [updated] = await db
    .update(potholesTable)
    .set({ votes: sql`${potholesTable.votes} + 1` })
    .where(eq(potholesTable.id, parsed.data.id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Pothole not found" });

  return res.json({ ...updated, timestamp: updated.timestamp.toISOString() });
});

export default router;
