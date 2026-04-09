import { createHash } from "crypto";
import { db, potholesTable } from "../db";
import { sql } from "drizzle-orm";

function stableId(key: string): string {
  const h = createHash("sha256").update(key).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16),
    ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32)].join("-");
}

function seededNum(seed: string, min: number, max: number): number {
  const n = parseInt(createHash("md5").update(seed).digest("hex").slice(0, 8), 16);
  return min + (n % 10000) / 10000 * (max - min);
}

type Tier = "Low" | "Medium" | "High" | "Critical";
const TIERS: Tier[] = ["Low", "Medium", "High", "Critical"];

const TIER_RANGES: Record<Tier, {
  depth: [number, number]; width: [number, number]; cost: [number, number]; conf: number;
}> = {
  Low:      { depth: [2, 4],   width: [10, 20],  cost: [0.06, 0.28], conf: 0.72 },
  Medium:   { depth: [4, 7],   width: [15, 30],  cost: [0.28, 0.75], conf: 0.80 },
  High:     { depth: [7, 10],  width: [25, 40],  cost: [0.55, 2.01], conf: 0.88 },
  Critical: { depth: [10, 14], width: [35, 55],  cost: [2.01, 5.56], conf: 0.94 },
};

function tierMetrics(tier: Tier, seed: string) {
  const r = TIER_RANGES[tier];
  const depth  = Math.round(seededNum(seed + "d", r.depth[0], r.depth[1]) * 10) / 10;
  const width  = Math.round(seededNum(seed + "w", r.width[0], r.width[1]) * 10) / 10;
  const cost   = Math.round(seededNum(seed + "c", r.cost[0], r.cost[1]) * 100) / 100;
  const volume = Math.round((depth / 100) * (width / 100) * (width / 100) * 1000) / 1000;
  return { depth, width, cost, volume, confidence: r.conf };
}

function worseTier(a: Tier, b: Tier): Tier {
  return TIERS[Math.max(TIERS.indexOf(a), TIERS.indexOf(b))];
}

interface PotholeRecord {
  id: string;
  lat: number;
  lon: number;
  severity: Tier;
  depth_cm: number;
  width_cm: number;
  volume_m3: number;
  estimated_repair_cost_usd: number;
  confidence: number;
  is_fixed: boolean;
  votes: number;
  address: string | null;
  timestamp: Date;
}

async function fetchChicago311(): Promise<PotholeRecord[]> {
  const url =
    "https://data.cityofchicago.org/resource/7as2-ds3y.json" +
    "?%24limit=500" +
    "&%24order=creation_date+DESC" +
    "&type_of_service_request=Pothole+in+Street" +
    "&%24select=latitude%2Clongitude%2Cstatus%2Ccreation_date%2Cstreet_address%2Cservice_request_number";

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Chicago 311 HTTP ${res.status}`);
  const rows = (await res.json()) as any[];

  return rows
    .filter((r) => r.latitude && r.longitude)
    .map((r) => {
      const lat = parseFloat(r.latitude);
      const lon = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lon)) return null;

      const srcKey = r.service_request_number ?? `chi:${lat},${lon}`;
      const id = stableId("chi311:" + srcKey);
      const tier: Tier = "Medium";
      const m = tierMetrics(tier, id);

      return {
        id,
        lat,
        lon,
        severity: tier,
        depth_cm: m.depth,
        width_cm: m.width,
        volume_m3: m.volume,
        estimated_repair_cost_usd: m.cost,
        confidence: 0.83,
        is_fixed: (r.status ?? "").toLowerCase() === "completed",
        votes: 0,
        address: r.street_address ? `${r.street_address}, Chicago, IL` : null,
        timestamp: r.creation_date ? new Date(r.creation_date) : new Date(),
      };
    })
    .filter(Boolean) as PotholeRecord[];
}

const BBOXES = [
  { name: "NYC Metro",    bbox: "-74.05,40.65,-73.70,40.85" },
  { name: "Chicago",      bbox: "-87.94,41.64,-87.52,42.02" },
  { name: "Los Angeles",  bbox: "-118.67,33.70,-117.90,34.35" },
  { name: "DC Metro",     bbox: "-77.12,38.79,-76.91,38.99" },
  { name: "Houston",      bbox: "-95.82,29.52,-95.14,30.12" },
  { name: "Philadelphia", bbox: "-75.28,39.86,-74.96,40.14" },
];

const CAT_TIER: Record<number, Tier> = {
  1: "High",
  3: "Medium",
  6: "Low",
  7: "High",
  8: "Critical",
  9: "Medium",
  12: "Medium",
};

function magnitudeTier(mag: number): Tier {
  if (mag >= 4) return "Critical";
  if (mag === 3) return "High";
  if (mag === 2) return "Medium";
  return "Low";
}

async function fetchTomTomBbox(apiKey: string, bbox: string): Promise<PotholeRecord[]> {
  const fields = encodeURIComponent(
    "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,from,to,startTime}}}"
  );
  const url =
    `https://api.tomtom.com/traffic/services/5/incidentDetails` +
    `?bbox=${bbox}&fields=${fields}&language=en-GB&t=1111&key=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`TomTom HTTP ${res.status} for ${bbox}`);
  const data: any = await res.json();
  const incidents: any[] = data?.incidents ?? [];

  return incidents
    .filter((inc) => {
      const cat: number = inc.properties?.iconCategory ?? 0;
      return Object.keys(CAT_TIER).map(Number).includes(cat);
    })
    .map((inc) => {
      const props = inc.properties ?? {};
      const cat: number = props.iconCategory ?? 0;
      const mag: number = props.magnitudeOfDelay ?? 0;

      const coords = inc.geometry?.coordinates;
      if (!coords || coords.length === 0) return null;
      const point = Array.isArray(coords[0]) ? coords[0] : coords;
      const lon = parseFloat(point[0]);
      const lat = parseFloat(point[1]);
      if (isNaN(lat) || isNaN(lon)) return null;

      const incId: string = props.id ?? `${lat},${lon}`;
      const id = stableId("tomtom:" + incId);
      const tier = worseTier(CAT_TIER[cat] ?? "Medium", magnitudeTier(mag));
      const m = tierMetrics(tier, id);

      const from: string = props.from ?? "";
      const to: string = props.to ?? "";
      const address = [from, to].filter(Boolean).join(" → ") || null;

      return {
        id,
        lat,
        lon,
        severity: tier,
        depth_cm: m.depth,
        width_cm: m.width,
        volume_m3: m.volume,
        estimated_repair_cost_usd: m.cost,
        confidence: m.confidence,
        is_fixed: false,
        votes: 0,
        address,
        timestamp: props.startTime ? new Date(props.startTime) : new Date(),
      };
    })
    .filter(Boolean) as PotholeRecord[];
}

async function fetchTomTom(apiKey: string): Promise<PotholeRecord[]> {
  const results = await Promise.allSettled(
    BBOXES.map(({ bbox }) => fetchTomTomBbox(apiKey, bbox))
  );
  return results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );
}

let lastSync: Date | null = null;
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

async function getExistingIds(): Promise<Set<string>> {
  const rows = await db.execute(sql`SELECT id FROM potholes`);
  return new Set((rows.rows as any[]).map((r) => r.id));
}

export async function syncLiveData(): Promise<{ inserted: number; sources: string[] }> {
  const apiKey = process.env["TOMTOM_API_KEY"];
  if (lastSync && Date.now() - lastSync.getTime() < SYNC_INTERVAL_MS) {
    return { inserted: 0, sources: [] };
  }

  console.log("[liveData] Starting sync…");
  const sourcesUsed: string[] = [];
  const allRecords: PotholeRecord[] = [];

  const [chicagoRes, tomtomRes] = await Promise.allSettled([
    fetchChicago311(),
    apiKey ? fetchTomTom(apiKey) : Promise.resolve([] as PotholeRecord[]),
  ]);

  if (chicagoRes.status === "fulfilled" && chicagoRes.value.length > 0) {
    allRecords.push(...chicagoRes.value);
    sourcesUsed.push("Chicago 311");
    console.log(`[liveData] Chicago 311: ${chicagoRes.value.length} records`);
  } else if (chicagoRes.status === "rejected") {
    console.warn("[liveData] Chicago 311 failed:", chicagoRes.reason?.message ?? chicagoRes.reason);
  }

  if (tomtomRes.status === "fulfilled" && tomtomRes.value.length > 0) {
    allRecords.push(...tomtomRes.value);
    sourcesUsed.push("TomTom Traffic");
    console.log(`[liveData] TomTom: ${tomtomRes.value.length} incidents across ${BBOXES.length} cities`);
  } else if (tomtomRes.status === "rejected") {
    console.warn("[liveData] TomTom failed:", (tomtomRes as any).reason?.message);
  }

  if (allRecords.length === 0) {
    console.log("[liveData] No external records fetched");
    lastSync = new Date();
    return { inserted: 0, sources: sourcesUsed };
  }

  const existingIds = await getExistingIds();
  const newRecords = allRecords.filter((r) => !existingIds.has(r.id));
  console.log(`[liveData] New records to insert: ${newRecords.length} (${allRecords.length - newRecords.length} already exist)`);

  let inserted = 0;
  const CHUNK = 50;
  for (let i = 0; i < newRecords.length; i += CHUNK) {
    const chunk = newRecords.slice(i, i + CHUNK);
    try {
      await db.insert(potholesTable).values(
        chunk.map((r) => ({
          id: r.id,
          lat: r.lat,
          lon: r.lon,
          severity: r.severity,
          depth_cm: r.depth_cm,
          width_cm: r.width_cm,
          volume_m3: r.volume_m3,
          estimated_repair_cost_usd: r.estimated_repair_cost_usd,
          image_base64: "",
          is_fixed: r.is_fixed,
          votes: r.votes,
          confidence: r.confidence,
          address: r.address,
          timestamp: r.timestamp,
        }))
      ).onConflictDoNothing();
      inserted += chunk.length;
    } catch (err) {
      console.error("[liveData] Insert chunk error:", err);
    }
  }

  lastSync = new Date();
  console.log(`[liveData] Sync complete — inserted ${inserted} from: ${sourcesUsed.join(", ") || "none"}`);
  return { inserted, sources: sourcesUsed };
}
