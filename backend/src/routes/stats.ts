import { Router } from "express";
import { db, potholesTable } from "../db";
import { eq, gte, sql, and } from "drizzle-orm";
import { GetHeatmapDataQueryParams } from "../zod/api";

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

router.get("/stats/summary", async (_req, res) => {
  const rows = await db.select().from(potholesTable);

  const total_potholes = rows.length;
  const total_fixed = rows.filter((r) => r.is_fixed).length;
  const high_severity = rows.filter(
    (r) => r.severity === "High" || r.severity === "Critical"
  ).length;
  const total_repair_cost_usd = rows.reduce(
    (sum, r) => sum + r.estimated_repair_cost_usd,
    0
  );
  const total_volume_m3 = rows.reduce((sum, r) => sum + r.volume_m3, 0);
  const total_asphalt_tons = total_volume_m3 * 2.3;

  const now24h = new Date();
  now24h.setHours(now24h.getHours() - 24);
  const potholes_24h = rows.filter((r) => r.timestamp >= now24h).length;
  const avg_depth_cm =
    rows.length > 0
      ? rows.reduce((sum, r) => sum + r.depth_cm, 0) / rows.length
      : 0;
  const city_savings_usd = rows
    .filter((r) => r.is_fixed)
    .reduce((sum, r) => sum + r.estimated_repair_cost_usd * 5, 0);

  return res.json({
    total_potholes,
    total_fixed,
    high_severity,
    total_repair_cost_usd: Math.round(total_repair_cost_usd * 100) / 100,
    total_volume_m3: Math.round(total_volume_m3 * 1000) / 1000,
    total_asphalt_tons: Math.round(total_asphalt_tons * 100) / 100,
    potholes_24h,
    avg_depth_cm: Math.round(avg_depth_cm * 10) / 10,
    city_savings_usd: Math.round(city_savings_usd * 100) / 100,
  });
});

router.get("/stats/heatmap", async (req, res) => {
  const parsed = GetHeatmapDataQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query params" });
  }

  let rows = await db.select().from(potholesTable);

  const dateFilter = getDateFilter(parsed.data.dateRange);
  if (dateFilter) {
    rows = rows.filter((r) => r.timestamp >= dateFilter);
  }

  const severityWeight: Record<string, number> = {
    Low: 0.25,
    Medium: 0.5,
    High: 0.75,
    Critical: 1.0,
  };

  return res.json(
    rows.map((r) => ({
      lat: r.lat,
      lon: r.lon,
      weight: severityWeight[r.severity] ?? 0.5,
    }))
  );
});

router.get("/stats/driver-score", async (_req, res) => {
  const rows = await db.select().from(potholesTable);
  const potholes_reported = rows.length;
  const confirmations_received = rows.reduce((sum, r) => sum + r.votes, 0);
  const score = potholes_reported * 10 + confirmations_received * 5;
  const city_savings_usd =
    rows
      .filter((r) => r.is_fixed)
      .reduce((sum, r) => sum + r.estimated_repair_cost_usd, 0) * 5;

  let level = "Rookie";
  let badge = "Road Watcher";
  let next_level_threshold = 100;

  if (score >= 500) {
    level = "Legend";
    badge = "City Guardian";
    next_level_threshold = 1000;
  } else if (score >= 200) {
    level = "Expert";
    badge = "Road Ranger";
    next_level_threshold = 500;
  } else if (score >= 100) {
    level = "Advanced";
    badge = "Pothole Hunter";
    next_level_threshold = 200;
  } else if (score >= 50) {
    level = "Intermediate";
    badge = "Street Scout";
    next_level_threshold = 100;
  }

  return res.json({
    score,
    level,
    potholes_reported,
    confirmations_received,
    city_savings_usd: Math.round(city_savings_usd * 100) / 100,
    badge,
    next_level_threshold,
  });
});

function getRegionAndCity(lat: number, lon: number, address?: string | null) {
  let city = "Unknown";
  let region = "Americas"; // Default

  if (address) {
    const parts = address.split(",").map((s) => s.trim());
    if (parts.length >= 2) {
      city = parts[parts.length - 2];
      const last = parts[parts.length - 1].toLowerCase();
      if (last.includes("india") || last.includes("pakistan") || last.includes("bangladesh") || last.includes("china")) region = "Asia";
      else if (last.includes("ukraine") || last.includes("germany") || last.includes("france") || last.includes("uk")) region = "Europe";
      else if (last.includes("egypt") || last.includes("nigeria") || last.includes("kenya")) region = "Africa";
      else if (last.includes("australia")) region = "Oceania";
    } else {
      city = parts[0];
    }
  }

  // Fallback to coordinates if address parsing is weak
  if (region === "Americas") {
    if (lon > 45 && lat > -10) region = "Asia";
    else if (lon > -30 && lon < 45) {
      if (lat > 35) region = "Europe";
      else region = "Africa";
    } else if (lon > 100 && lat < 0) region = "Oceania";
  }

  if (city === "Unknown" || !city) {
    if (region === "Asia") city = "New Delhi";
    else if (region === "Americas") city = "Chicago";
    else if (region === "Europe") city = "Berlin";
    else if (region === "Africa") city = "Cairo";
    else city = "Sydney";
  }

  return { city, region };
}

router.get("/stats/detailed-metrics", async (_req, res) => {
  try {
    const rows = await db.select().from(potholesTable);
    console.log(`[Backend] /stats/detailed-metrics: Found ${rows.length} potholes in database`);

  // 1. Severity Distribution
  const sevCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  rows.forEach((r) => {
    if (sevCounts.hasOwnProperty(r.severity))
      sevCounts[r.severity as keyof typeof sevCounts]++;
  });
  const severity_distribution = [
    { label: "Critical", count: sevCounts.Critical, color: "#f43f5e" },
    { label: "High", count: sevCounts.High, color: "#fb923c" },
    { label: "Medium", count: sevCounts.Medium, color: "#fbbf24" },
    { label: "Low", count: sevCounts.Low, color: "#34d399" },
  ].map((d) => ({
    ...d,
    percentage: rows.length > 0 ? Math.round((d.count / rows.length) * 100) : 0,
  }));

  // 2. Geographical Aggregation
  const cityData: Record<string, { cost: number; severity: string; region: string }> = {};
  const regionalData: Record<string, any> = {
    Asia: { total_cost: 0, avg_severity: 0, critical_count: 0, high_count: 0, city_count: 0, potholes: [] },
    Africa: { total_cost: 0, avg_severity: 0, critical_count: 0, high_count: 0, city_count: 0, potholes: [] },
    Americas: { total_cost: 0, avg_severity: 0, critical_count: 0, high_count: 0, city_count: 0, potholes: [] },
    Europe: { total_cost: 0, avg_severity: 0, critical_count: 0, high_count: 0, city_count: 0, potholes: [] },
    Oceania: { total_cost: 0, avg_severity: 0, critical_count: 0, high_count: 0, city_count: 0, potholes: [] },
  };

  rows.forEach((r) => {
    const { city, region } = getRegionAndCity(r.lat, r.lon, r.address);
    if (!cityData[city]) cityData[city] = { cost: 0, severity: r.severity, region };
    cityData[city].cost += r.estimated_repair_cost_usd;

    const reg = regionalData[region] || regionalData.Americas;
    reg.total_cost += r.estimated_repair_cost_usd;
    reg.potholes.push(r);
    if (r.severity === "Critical") reg.critical_count++;
    if (r.severity === "High") reg.high_count++;
  });

  const top_cities = Object.entries(cityData)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const regional_stats: Record<string, any> = {};
  for (const [name, data] of Object.entries(regionalData)) {
    const sevMap: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const avgSev = data.potholes.length > 0
      ? data.potholes.reduce((sm: number, p: any) => sm + (sevMap[p.severity] || 0), 0) / data.potholes.length
      : 0;

    const citySet = new Set(data.potholes.map((p: any) => getRegionAndCity(p.lat, p.lon, p.address).city));
    
    // Sort cities in region by cost for notes
    const regionalCities: Record<string, number> = {};
    data.potholes.forEach((p: any) => {
      const c = getRegionAndCity(p.lat, p.lon, p.address).city;
      regionalCities[c] = (regionalCities[c] || 0) + p.estimated_repair_cost_usd;
    });

    regional_stats[name] = {
      total_cost: Math.round(data.total_cost * 100) / 100,
      avg_severity: Math.round(avgSev * 10) / 10,
      critical_count: data.critical_count,
      high_count: data.high_count,
      city_count: citySet.size,
      severity_distribution: ["Critical", "High", "Medium", "Low"].map(l => ({
        label: l,
        count: data.potholes.filter((p: any) => p.severity === l).length,
        percentage: data.potholes.length > 0 ? Math.round((data.potholes.filter((p: any) => p.severity === l).length / data.potholes.length) * 100) : 0
      })),
      top_cities: Object.entries(regionalCities).sort((a, b) => b[1] - a[1]).slice(0, 5).map(c => ({
        name: c[0],
        cost: Math.round(c[1] * 100) / 100,
        severity: "High" // Default for top list
      })),
      notes: Object.entries(regionalCities).sort((a, b) => b[1] - a[1]).slice(0, 3).map(c => ({
        city: c[0],
        note: `Anomaly detected in ${c[0]} infrastructure grid. Maintenance advised.`,
        severity: "Critical"
      }))
    };
  }

  // 3. Cost Trend (last 6 months)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const cost_trend = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mName = months[d.getMonth()];
    const mRows = rows.filter(r => r.timestamp.getMonth() === d.getMonth() && r.timestamp.getFullYear() === d.getFullYear());
    const mCost = mRows.reduce((sm, r) => sm + r.estimated_repair_cost_usd, 0);
    cost_trend.push({
      month: mName,
      cost: Math.round(mCost * 100) / 100,
      projected: Math.round(mCost * 1.2 * 100) / 100
    });
  }

  return res.json({
    severity_distribution,
    top_cities,
    regional_stats,
    cost_trend,
  });
  } catch (err: any) {
    console.error(`[Backend] /stats/detailed-metrics ERROR:`, err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
