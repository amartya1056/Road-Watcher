import { Router } from "express";
import { db, potholesTable } from "../db";
import { GetPotholeAwareRouteBody } from "../zod/api";

const router = Router();

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.post("/route/pothole-aware", async (req, res) => {
  const parsed = GetPotholeAwareRouteBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const { start_lat, start_lon, end_lat, end_lon } = parsed.data;

  let osrmData: { geometry?: unknown; distance?: number; duration?: number } =
    {};
  try {
    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${start_lon},${start_lat};${end_lon},${end_lat}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
    if (osrmRes.ok) {
      const data = (await osrmRes.json()) as {
        routes?: Array<{
          geometry?: unknown;
          distance?: number;
          duration?: number;
        }>;
      };
      if (data.routes && data.routes.length > 0) {
        osrmData = {
          geometry: data.routes[0].geometry,
          distance: data.routes[0].distance,
          duration: data.routes[0].duration,
        };
      }
    }
  } catch {
  }

  if (!osrmData.geometry) {
    osrmData = {
      geometry: {
        type: "LineString",
        coordinates: [
          [start_lon, start_lat],
          [end_lon, end_lat],
        ],
      },
      distance: haversineDistance(start_lat, start_lon, end_lat, end_lon),
      duration:
        haversineDistance(start_lat, start_lon, end_lat, end_lon) / 13.9,
    };
  }

  const allPotholes = await db.select().from(potholesTable);

  const routePotholes = allPotholes.filter((p) => {
    const distToStart = haversineDistance(p.lat, p.lon, start_lat, start_lon);
    const distToEnd = haversineDistance(p.lat, p.lon, end_lat, end_lon);
    const routeLength = haversineDistance(start_lat, start_lon, end_lat, end_lon);
    return distToStart + distToEnd <= routeLength * 1.2 + 200;
  });

  const has_danger = routePotholes.some(
    (p) => p.severity === "High" || p.severity === "Critical"
  );
  const total_repair_cost_on_route = routePotholes.reduce(
    (sum, p) => sum + p.estimated_repair_cost_usd,
    0
  );

  return res.json({
    geometry: osrmData.geometry,
    distance_m: osrmData.distance ?? 0,
    duration_s: osrmData.duration ?? 0,
    pothole_warnings: routePotholes.map((p) => ({
      ...p,
      timestamp: p.timestamp.toISOString(),
    })),
    has_danger,
    total_repair_cost_on_route: Math.round(total_repair_cost_on_route * 100) / 100,
  });
});

export default router;
