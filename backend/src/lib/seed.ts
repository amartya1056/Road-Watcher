import { db, potholesTable } from "../db";
import { sql } from "drizzle-orm";

const SEED_POTHOLES: any[] = [];

export async function seedIfEmpty(): Promise<void> {
  try {
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM potholes`);
    const count = Number((countResult.rows[0] as any)?.count ?? 0);
    if (count > 0) {
      return;
    }
    await db.insert(potholesTable).values(
      SEED_POTHOLES.map((p) => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        severity: p.severity,
        depth_cm: p.depth_cm,
        width_cm: p.width_cm,
        volume_m3: p.volume_m3,
        estimated_repair_cost_usd: p.estimated_repair_cost_usd,
        image_base64: "",
        is_fixed: p.is_fixed,
        votes: p.votes,
        confidence: p.confidence,
        address: p.address,
        timestamp: p.timestamp,
      }))
    );
    console.log(`[seed] Inserted ${SEED_POTHOLES.length} seed potholes`);
  } catch (err) {
    console.error("[seed] Failed to seed potholes:", err);
  }
}
