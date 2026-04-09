import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Route as RouteIcon, Activity, Layers, Calendar, Search, Satellite,
  Scan, Zap, Shield, TrendingUp, X, MapPin, Globe, Database, Plus, Minus
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  useListPotholes,
  useCreatePothole,
  useGetPotholeAwareRoute,
  useGetStatsSummary,
  useGetDriverScore,
  useVotePothole,
  useUpdatePothole,
  getListPotholesQueryKey,
  getGetStatsSummaryQueryKey,
  getGetDriverScoreQueryKey,
} from "@/api";

type CreatePotholeBodySeverity = "Low" | "Medium" | "High" | "Critical";
type ListPotholesDateRange = "24h" | "week" | "month" | "all";


import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/currency";
import { useTheme } from "@/context/theme";
import { GLOBAL_HOTSPOTS } from "@/data/hotspots";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function latLonToTile(lat: number, lon: number, z: number) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

// ESRI World Imagery — real satellite photos, free, no API key
function esriSatTile(z: number, y: number, x: number) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

// OSM tile for the scan animation background
function osmTileUrl(lat: number, lon: number, zoom = 17) {
  const { x, y } = latLonToTile(lat, lon, zoom);
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

function severityColor(sev: string) {
  if (sev === "Critical") return "#f43f5e";
  if (sev === "High")     return "#fb923c";
  if (sev === "Medium")   return "#fbbf24";
  return "#34d399";
}

function severityGradient(sev: string) {
  if (sev === "Critical") return "linear-gradient(135deg, #f43f5e, #be123c)";
  if (sev === "High")     return "linear-gradient(135deg, #fb923c, #ea580c)";
  if (sev === "Medium")   return "linear-gradient(135deg, #fbbf24, #d97706)";
  return "linear-gradient(135deg, #34d399, #059669)";
}

// ─── Overpass API (real global OSM pothole / road-damage data) ────────────────

interface OsmPothole {
  lat: number; lon: number; id: number;
  tags: Record<string, string>;
  type: "node" | "way";
}

async function fetchOverpassData(
  bounds: L.LatLngBounds,
  zoom: number,
  signal: AbortSignal,
): Promise<OsmPothole[]> {
  if (zoom < 9) return [];
  const s = bounds.getSouth().toFixed(5);
  const w = bounds.getWest().toFixed(5);
  const n = bounds.getNorth().toFixed(5);
  const e = bounds.getEast().toFixed(5);
  // Adaptive query: lighter at low zoom (large bbox), full at high zoom
  const detailed = zoom >= 13;
  const lines: string[] = [
    "[out:json][timeout:25][maxsize:2000000];",
    "(",
    `node["barrier"="pothole"](${s},${w},${n},${e});`,
    `node["surface"="pothole"](${s},${w},${n},${e});`,
  ];
  if (detailed) {
    lines.push(
      `way["surface"="very_bad"]["highway"](${s},${w},${n},${e});`,
      `way["surface"="bad"]["highway"](${s},${w},${n},${e});`,
      // smoothness tags — widely used in India, Africa and SE Asia
      `way["smoothness"="very_bad"]["highway"](${s},${w},${n},${e});`,
      `way["smoothness"="horrible"]["highway"](${s},${w},${n},${e});`,
      `way["smoothness"="impassable"]["highway"](${s},${w},${n},${e});`,
    );
  }
  lines.push(");", `out center body ${detailed ? 500 : 200};`);
  const query = lines.join("\n");
  const res = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    { signal }
  );
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const text = await res.text();
  // Guard against XML error responses
  if (text.trimStart().startsWith("<")) throw new Error("Overpass returned XML (rate limit or bad query)");
  const json = JSON.parse(text);
  return (json.elements as any[])
    .map((el) => ({
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
      id: el.id,
      tags: el.tags ?? {},
      type: el.type as "node" | "way",
    }))
    .filter((el) => el.lat && el.lon);
}

// ─── Scan canvas overlay ──────────────────────────────────────────────────────

function drawSatelliteScanOverlay(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  scanProgress: number,
  detections: Array<{ x: number; y: number; w: number; h: number; conf: number; sev: string }>
) {
  const sweepY = scanProgress * h;
  const g = ctx.createLinearGradient(0, Math.max(0, sweepY - 40), 0, sweepY + 4);
  g.addColorStop(0, "rgba(139,92,246,0)");
  g.addColorStop(0.6, "rgba(139,92,246,0.06)");
  g.addColorStop(1, "rgba(139,92,246,0.45)");
  ctx.fillStyle = g; ctx.fillRect(0, Math.max(0, sweepY - 40), w, 44);
  ctx.strokeStyle = "rgba(167,139,250,0.8)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, sweepY); ctx.lineTo(w, sweepY); ctx.stroke();
  ctx.strokeStyle = "rgba(139,92,246,0.06)"; ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const bs = 14; ctx.strokeStyle = "rgba(167,139,250,0.6)"; ctx.lineWidth = 2;
  [[0, 0], [w, 0], [0, h], [w, h]].forEach(([cx, cy]) => {
    const dx = cx === 0 ? 1 : -1, dy = cy === 0 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(cx, cy + dy * bs); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * bs, cy); ctx.stroke();
  });
  detections.forEach((d) => {
    const col = severityColor(d.sev);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
    ctx.strokeRect(d.x, d.y, d.w, d.h); ctx.setLineDash([]);
    ctx.fillStyle = col;
    [[d.x, d.y], [d.x + d.w, d.y], [d.x, d.y + d.h], [d.x + d.w, d.y + d.h]].forEach(([px, py]) => {
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
    });
    const lbl = `POTHOLE  ${Math.round(d.conf * 100)}%`;
    ctx.font = "bold 9px Inter,monospace";
    const tw = ctx.measureText(lbl).width;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    (ctx as any).roundRect?.(d.x, d.y - 18, tw + 10, 16, 3); ctx.fill();
    ctx.fillStyle = col; ctx.fillText(lbl, d.x + 5, d.y - 5);
    ctx.shadowColor = col; ctx.shadowBlur = 6; ctx.strokeStyle = col; ctx.lineWidth = 0.5;
    ctx.strokeRect(d.x - 3, d.y - 3, d.w + 6, d.h + 6); ctx.shadowBlur = 0;
  });
}

// ─── Satellite Image Panel (ESRI World Imagery) ───────────────────────────────

interface SelectedMarker {
  lat: number; lon: number; source: "db" | "osm";
  // DB fields
  dbId?: string; severity?: string; depth_cm?: number; width_cm?: number;
  volume_m3?: number; estimated_repair_cost_usd?: number; confidence?: number;
  votes?: number; is_fixed?: boolean; address?: string | null;
  // OSM fields
  osmTags?: Record<string, string>;
}

const SAT_ZOOM_LABELS: Record<number, string> = {
  14: "City (1 km)", 15: "District (500 m)", 16: "Street (250 m)",
  17: "Block (125 m)", 18: "Building (60 m)", 19: "Detail (30 m)",
};

function SatelliteImageView({ lat, lon, zoom }: { lat: number; lon: number; zoom: number }) {
  const { x, y } = latLonToTile(lat, lon, zoom);
  const tiles: { tx: number; ty: number; key: string }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      tiles.push({ tx: x + dx, ty: y + dy, key: `${dx},${dy}` });
    }
  }
  return (
    <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "1" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, width: "100%", height: "100%" }}>
        {tiles.map(({ tx, ty, key }) => (
          <img key={`${zoom}-${key}`} src={esriSatTile(zoom, ty, tx)} loading="lazy" crossOrigin="anonymous"
            style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", background: "#060810" }}
            onError={(e) => { (e.target as HTMLImageElement).style.background = "#1e293b"; }} />
        ))}
      </div>
      {/* Crosshair */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(167,139,250,0.95)", boxShadow: "0 0 0 6px rgba(167,139,250,0.15), 0 0 20px rgba(167,139,250,0.4)" }} />
        <div style={{ position: "absolute", top: "50%", left: "calc(50% - 24px)", width: 48, height: 1, background: "rgba(167,139,250,0.7)" }} />
        <div style={{ position: "absolute", top: "calc(50% - 24px)", left: "50%", width: 1, height: 48, background: "rgba(167,139,250,0.7)" }} />
        {[["0%","0%","right","bottom"], ["100%","0%","left","bottom"], ["0%","100%","right","top"], ["100%","100%","left","top"]].map(([l, t, br, bb]) => (
          <div key={`${l}${t}`} style={{
            position: "absolute", left: l, top: t, width: 12, height: 12,
            borderRight: br === "right" ? "none" : "2px solid rgba(167,139,250,0.6)",
            borderLeft: br === "left" ? "none" : "2px solid rgba(167,139,250,0.6)",
            borderBottom: bb === "bottom" ? "none" : "2px solid rgba(167,139,250,0.6)",
            borderTop: bb === "top" ? "none" : "2px solid rgba(167,139,250,0.6)",
          }} />
        ))}
      </div>
      {/* Zoom level label */}
      <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.75)", padding: "2px 7px", borderRadius: 4, fontSize: 8, color: "var(--violet-fg)", letterSpacing: "0.3px", backdropFilter: "blur(4px)", fontFamily: "monospace" }}>
        z{zoom} · {SAT_ZOOM_LABELS[zoom] ?? ""}
      </div>
      {/* Attribution */}
      <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.75)", padding: "2px 6px", borderRadius: 4, fontSize: 8, color: "#64748b", letterSpacing: "0.3px", backdropFilter: "blur(4px)" }}>
        © Esri, Maxar, Earthstar Geographics
      </div>
    </div>
  );
}

// ─── Pothole Detail Panel ─────────────────────────────────────────────────────

function PotholeDetailPanel({ marker, onClose, onMarkFixed }: {
  marker: SelectedMarker;
  onClose: () => void;
  onMarkFixed: (id: string) => void;
}) {
  const { fmt } = useCurrency();
  const [satZoom, setSatZoom] = useState(17);
  const isSurface = marker.source === "osm" && (marker.osmTags?.surface === "very_bad" || marker.osmTags?.surface === "bad");
  const osmSeverity = isSurface ? (marker.osmTags?.surface === "very_bad" ? "High" : "Medium") : "Critical";
  const displaySeverity = marker.source === "db" ? marker.severity! : osmSeverity;
  const sc = severityColor(displaySeverity);
  const sg = severityGradient(displaySeverity);

  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
      className="rounded-2xl overflow-hidden gradient-border" style={{ background: "var(--surface-1)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-section)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: sc, boxShadow: `0 0 8px ${sc}` }} />
          <span className="text-sm font-bold text-foreground">Pothole Detail</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Source badge */}
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide"
            style={marker.source === "osm"
              ? { background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8" }
              : { background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "var(--violet-fg)" }}>
            {marker.source === "osm" ? <><Globe size={8} /> OSM</> : <><Database size={8} /> SkyMap</>}
          </span>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10" style={{ color: "#64748b" }}>
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* ESRI Satellite Image */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Satellite size={11} className="text-violet-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Satellite View</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                ESRI
              </span>
            </div>
            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSatZoom((z) => Math.max(14, z - 1))}
                disabled={satZoom <= 14}
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                style={{ background: satZoom <= 14 ? "var(--surface-subtle)" : "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: satZoom <= 14 ? "#334155" : "#a78bfa" }}>
                <Minus size={10} />
              </button>
              <span className="text-[10px] font-mono font-bold w-5 text-center" style={{ color: "var(--violet-fg)" }}>{satZoom}</span>
              <button
                onClick={() => setSatZoom((z) => Math.min(19, z + 1))}
                disabled={satZoom >= 19}
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                style={{ background: satZoom >= 19 ? "var(--surface-subtle)" : "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: satZoom >= 19 ? "#334155" : "#a78bfa" }}>
                <Plus size={10} />
              </button>
            </div>
          </div>
          <SatelliteImageView lat={marker.lat} lon={marker.lon} zoom={satZoom} />
        </div>

        {/* Coordinates */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
          <MapPin size={11} className="text-muted-foreground shrink-0" />
          <span className="text-[10px] font-mono text-muted-foreground">
            {marker.lat.toFixed(6)}° N, {marker.lon.toFixed(6)}°{marker.lon < 0 ? " W" : " E"}
          </span>
        </div>

        {/* DB Pothole Details */}
        {marker.source === "db" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
                <p className="text-[9px] text-muted-foreground uppercase mb-1">Severity</p>
                <p className="text-xs font-bold" style={{ background: sg, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{marker.severity}</p>
              </div>
              <div className="p-2.5 rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
                <p className="text-[9px] text-muted-foreground uppercase mb-1">Repair Cost</p>
                <p className="text-xs font-mono font-bold" style={{ color: "#fb923c" }}>{fmt(marker.estimated_repair_cost_usd ?? 0)}</p>
              </div>
              <div className="p-2.5 rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
                <p className="text-[9px] text-muted-foreground uppercase mb-1">Depth</p>
                <p className="text-xs font-mono font-semibold text-foreground">{marker.depth_cm} cm</p>
              </div>
              <div className="p-2.5 rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
                <p className="text-[9px] text-muted-foreground uppercase mb-1">Width</p>
                <p className="text-xs font-mono font-semibold text-foreground">{marker.width_cm} cm</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-muted-foreground uppercase mb-1.5">Satellite Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-section)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(marker.confidence ?? 0) * 100}%`, background: "linear-gradient(90deg, #7c3aed, #818cf8)" }} />
                  </div>
                  <span className="text-[10px] font-mono text-violet-400 font-bold">{Math.round((marker.confidence ?? 0) * 100)}%</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground uppercase mb-1">Status</p>
                {marker.is_fixed
                  ? <span className="text-[10px] font-bold text-emerald-400">✓ Repaired</span>
                  : <span className="text-[10px] font-bold" style={{ color: "#fb7185" }}>⚠ Active</span>}
              </div>
            </div>
            {!marker.is_fixed && marker.dbId && (
              <button onClick={() => onMarkFixed(marker.dbId!)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.2), rgba(5,150,105,0.15))", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }}>
                Mark as Repaired
              </button>
            )}
          </>
        )}

        {/* OSM Pothole Details */}
        {marker.source === "osm" && (
          <>
            <div className="p-3 rounded-xl space-y-1.5" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Globe size={9} /> OpenStreetMap Community Data
              </p>
              {Object.entries(marker.osmTags ?? {}).slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground font-mono">{k}</span>
                  <span className="text-foreground font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <div className="p-2.5 rounded-xl text-center" style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)" }}>
              <p className="text-[9px] text-sky-400">Source: OpenStreetMap Contributors · ODbL License</p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SatelliteDetection {
  lat: number; lon: number; severity: CreatePotholeBodySeverity;
  depth_cm: number; width_cm: number; volume_m3: number;
  estimated_repair_cost_usd: number; confidence: number;
  address?: string | null; tileUrl: string;
}

const TIME_TABS: { value: ListPotholesDateRange; label: string }[] = [
  { value: "24h", label: "24H" }, { value: "week", label: "Week" },
  { value: "month", label: "Month" }, { value: "all", label: "All" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const DARK_MAP_FILTER = "invert(1) hue-rotate(180deg) brightness(0.6) saturate(0.45) contrast(1.1)";

export default function Home() {
  const { toast } = useToast();
  const { fmt } = useCurrency();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const isDarkMapRef = useRef(isDark);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dbMarkersRef = useRef<L.CircleMarker[]>([]);
  const osmMarkersRef = useRef<L.CircleMarker[]>([]);
  const hotspotMarkersRef = useRef<L.CircleMarker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const satCanvasRef = useRef<HTMLCanvasElement>(null);
  const lidarCanvasRef = useRef<HTMLCanvasElement>(null);
  const satImgRef = useRef<HTMLImageElement | null>(null);
  const scanAnimRef = useRef<number | null>(null);
  const scanProgressRef = useRef(0);
  const overpassTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overpassAbortRef = useRef<AbortController | null>(null);
  const mapZoomRef = useRef(13);

  const [userLoc, setUserLoc] = useState<[number, number]>([-74.006, 40.7128]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "acquiring" | "processing" | "detected">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [lastDetection, setLastDetection] = useState<SatelliteDetection | null>(null);
  const [scanQueue, setScanQueue] = useState<SatelliteDetection[]>([]);
  const [currentScanIdx, setCurrentScanIdx] = useState(0);
  const [timeRange, setTimeRange] = useState<ListPotholesDateRange>("all");
  const [routeEnd, setRouteEnd] = useState("");
  const [orbitPos, setOrbitPos] = useState({ az: 247, el: 62 });
  const [signalStrength, setSignalStrength] = useState(94);
  const [selectedMarker, setSelectedMarker] = useState<SelectedMarker | null>(null);
  const [osmPotholes, setOsmPotholes] = useState<OsmPothole[]>([]);
  const [isFetchingOsm, setIsFetchingOsm] = useState(false);
  const [mapZoom, setMapZoom] = useState(13);

  const { data: potholes } = useListPotholes({ dateRange: timeRange }, { query: { queryKey: getListPotholesQueryKey({ dateRange: timeRange }) } });
  const { data: stats } = useGetStatsSummary({ query: { queryKey: getGetStatsSummaryQueryKey() } });
  const { data: driverScore } = useGetDriverScore({ query: { queryKey: getGetDriverScoreQueryKey() } });
  const createPothole = useCreatePothole();
  const getRoute = useGetPotholeAwareRoute();
  const votePothole = useVotePothole();
  const updatePothole = useUpdatePothole();

  // ── Sync isDark ref + update map filter on theme change ─────────────────────
  useEffect(() => { isDarkMapRef.current = isDark; }, [isDark]);
  useEffect(() => {
    const pane = mapContainer.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
    if (pane) pane.style.filter = isDark ? DARK_MAP_FILTER : "none";
  }, [isDark]);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    const map = L.map(mapContainer.current, { center: [40.7128, -74.006], zoom: 13 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 19,
    }).addTo(map);

    const applyFilter = () => {
      const pane = mapContainer.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
      if (pane) pane.style.filter = isDarkMapRef.current ? DARK_MAP_FILTER : "none";
    };
    applyFilter();
    const obs = new MutationObserver(applyFilter);
    obs.observe(mapContainer.current, { childList: true, subtree: true });
    mapRef.current = map;

    // Track zoom
    map.on("zoom", () => {
      mapZoomRef.current = map.getZoom();
      setMapZoom(map.getZoom());
    });

    // Debounced Overpass fetch on map move/zoom
    const triggerOverpass = () => {
      if (overpassTimerRef.current) clearTimeout(overpassTimerRef.current);
      overpassTimerRef.current = setTimeout(async () => {
        if (overpassAbortRef.current) overpassAbortRef.current.abort();
        const ac = new AbortController();
        overpassAbortRef.current = ac;
        setIsFetchingOsm(true);
        try {
          const results = await fetchOverpassData(map.getBounds(), map.getZoom(), ac.signal);
          setOsmPotholes(results);
        } catch (e: any) {
          if (e.name !== "AbortError") console.warn("Overpass:", e?.message ?? e);
        } finally {
          setIsFetchingOsm(false);
        }
      }, 1400);
    };
    map.on("moveend", triggerOverpass);
    map.on("zoomend", triggerOverpass);

    // Trigger initial fetch after map settles
    setTimeout(triggerOverpass, 800);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLoc([pos.coords.longitude, pos.coords.latitude]);
        map.setView([pos.coords.latitude, pos.coords.longitude], 14);
      });
    }

    // GLOBAL_HOTSPOTS have been removed to ensure only real pipeline data is projected.

    return () => obs.disconnect();
  }, []);

  // ── DB markers ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    dbMarkersRef.current.forEach((m) => m.remove());
    dbMarkersRef.current = [];
    potholes?.forEach((p) => {
      const color = severityColor(p.severity);
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 8, fillColor: color, color: "rgba(255,255,255,0.4)",
        weight: 1.5, fillOpacity: 0.9,
      }).addTo(mapRef.current!);
      marker.on("click", () => {
        setSelectedMarker({
          lat: p.lat, lon: p.lon, source: "db",
          dbId: p.id, severity: p.severity,
          depth_cm: p.depth_cm, width_cm: p.width_cm,
          volume_m3: p.volume_m3, estimated_repair_cost_usd: p.estimated_repair_cost_usd,
          confidence: p.confidence, votes: p.votes,
          is_fixed: p.is_fixed, address: p.address,
        });
        mapRef.current?.setView([p.lat, p.lon], Math.max(mapRef.current.getZoom(), 16));
      });
      dbMarkersRef.current.push(marker);
    });
  }, [potholes, timeRange]);

  // ── OSM markers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    osmMarkersRef.current.forEach((m) => m.remove());
    osmMarkersRef.current = [];
    osmPotholes.forEach((p) => {
      const isSurface = p.tags.surface === "very_bad" || p.tags.surface === "bad";
      const color = isSurface ? "#fb923c" : "#f43f5e";
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 6, fillColor: "transparent", color,
        weight: 2, fillOpacity: 0, opacity: 0.85,
      }).addTo(mapRef.current!);
      marker.on("click", () => {
        setSelectedMarker({ lat: p.lat, lon: p.lon, source: "osm", osmTags: p.tags });
        mapRef.current?.setView([p.lat, p.lon], Math.max(mapRef.current.getZoom(), 16));
      });
      osmMarkersRef.current.push(marker);
    });
  }, [osmPotholes]);

  // ── Scan queue ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isScanning || !potholes) return;
    setScanQueue(potholes.map((p) => ({
      lat: p.lat, lon: p.lon, severity: p.severity as CreatePotholeBodySeverity,
      depth_cm: p.depth_cm, width_cm: p.width_cm, volume_m3: p.volume_m3,
      estimated_repair_cost_usd: p.estimated_repair_cost_usd,
      confidence: p.confidence, address: p.address,
      tileUrl: osmTileUrl(p.lat, p.lon),
    })));
    setCurrentScanIdx(0);
  }, [isScanning, potholes]);

  // ── Canvas animation ─────────────────────────────────────────────────────────
  const runScanFrame = useCallback(() => {
    const canvas = satCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (satImgRef.current?.complete) {
      ctx.save();
      ctx.filter = "brightness(0.3) saturate(0.2) hue-rotate(200deg) contrast(1.5)";
      ctx.drawImage(satImgRef.current, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.fillStyle = "#060810"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const p = scanProgressRef.current;
    const dets = p > 0.55 && lastDetection ? [{
      x: canvas.width * 0.18 + Math.sin(Date.now() / 2000) * 4,
      y: canvas.height * 0.28, w: canvas.width * 0.56, h: canvas.height * 0.4,
      conf: lastDetection.confidence, sev: lastDetection.severity,
    }] : [];
    drawSatelliteScanOverlay(ctx, canvas.width, canvas.height, p, dets);
    scanAnimRef.current = requestAnimationFrame(runScanFrame);
  }, [lastDetection]);

  useEffect(() => {
    if (isScanning) { scanAnimRef.current = requestAnimationFrame(runScanFrame); }
    else {
      if (scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current);
      const ctx = satCanvasRef.current?.getContext("2d");
      if (ctx && satCanvasRef.current) ctx.clearRect(0, 0, satCanvasRef.current.width, satCanvasRef.current.height);
    }
    return () => { if (scanAnimRef.current) cancelAnimationFrame(scanAnimRef.current); };
  }, [isScanning, runScanFrame]);

  // ── Scan cycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isScanning || scanQueue.length === 0) return;
    let cancelled = false;
    const target = scanQueue[currentScanIdx % scanQueue.length];
    const img = new Image(); img.crossOrigin = "anonymous"; img.src = target.tileUrl;
    img.onload = () => { satImgRef.current = img; };
    setScanStatus("acquiring"); scanProgressRef.current = 0; setScanProgress(0);
    const start = Date.now();
    const sweepInterval = setInterval(() => {
      if (cancelled) return clearInterval(sweepInterval);
      const pp = Math.min((Date.now() - start) / 2500, 1);
      scanProgressRef.current = pp; setScanProgress(pp);
      if (pp >= 1) clearInterval(sweepInterval);
    }, 16);
    const t1 = setTimeout(() => { if (!cancelled) setScanStatus("processing"); }, 700);
    const t2 = setTimeout(() => {
      if (cancelled) return;
      setScanStatus("detected"); setLastDetection(target);
      const lc = lidarCanvasRef.current;
      if (lc) {
        const lctx = lc.getContext("2d")!;
        lctx.clearRect(0, 0, lc.width, lc.height);
        const gr = lctx.createRadialGradient(lc.width / 2, lc.height / 2, 0, lc.width / 2, lc.height / 2, lc.width / 2);
        gr.addColorStop(0, "rgba(167,139,250,0.9)"); gr.addColorStop(0.3, "rgba(56,189,248,0.7)");
        gr.addColorStop(0.65, "rgba(20,184,166,0.55)"); gr.addColorStop(1, "rgba(244,63,94,0.3)");
        lctx.fillStyle = gr; lctx.fillRect(0, 0, lc.width, lc.height);
        lctx.strokeStyle = "rgba(255,255,255,0.1)"; lctx.lineWidth = 1;
        for (let r = 8; r < lc.width / 2; r += 14) { lctx.beginPath(); lctx.arc(lc.width / 2, lc.height / 2, r, 0, Math.PI * 2); lctx.stroke(); }
        lctx.fillStyle = "rgba(255,255,255,0.9)"; lctx.fillRect(lc.width / 2 - 2, lc.height / 2 - 2, 4, 4);
      }
      mapRef.current?.setView([target.lat, target.lon], 16);
      toast({ title: "Satellite Detection", description: `${target.severity} — ${target.depth_cm}cm · ${fmt(target.estimated_repair_cost_usd)}`, variant: target.severity === "Critical" || target.severity === "High" ? "destructive" : "default" });
      queryClient.invalidateQueries({ queryKey: getListPotholesQueryKey({ dateRange: timeRange }) });
      queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
    }, 3200);
    const t3 = setTimeout(() => {
      if (cancelled) return;
      setScanStatus("acquiring"); setCurrentScanIdx((i) => i + 1);
      if (false) {
        // Mock generation disabled to ensure pipeline-only data.
      }
    }, 6000);
    const telInterval = setInterval(() => {
      setOrbitPos((pp) => ({ az: (pp.az + 0.3 + Math.random() * 0.2) % 360, el: Math.max(15, Math.min(85, pp.el + (Math.random() - 0.5) * 0.5)) }));
      setSignalStrength((s) => Math.max(80, Math.min(99, s + (Math.random() - 0.5) * 3)));
    }, 800);
    return () => { cancelled = true; clearInterval(sweepInterval); clearInterval(telInterval); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isScanning, scanQueue, currentScanIdx, userLoc, timeRange]);

  // ── Route handler ────────────────────────────────────────────────────────────
  const handleRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeEnd) return;
    getRoute.mutate({ data: { start_lat: userLoc[1], start_lon: userLoc[0], end_lat: userLoc[1] + 0.02, end_lon: userLoc[0] + 0.02 } }, {
      onSuccess: (data) => {
        if (!mapRef.current) return;
        if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
        if (data.geometry?.coordinates) {
          const coords = (data.geometry as any).coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          routeLayerRef.current = L.polyline(coords, { color: "#8b5cf6", weight: 5, opacity: 0.9 }).addTo(mapRef.current);
          mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
        }
        if (data.has_danger) toast({ title: "Hazardous Route", description: `${data.pothole_warnings.length} potholes ahead · $${data.total_repair_cost_on_route} est. damage`, variant: "destructive" });
      },
    });
  };

  const handleMarkFixed = (id: string) => {
    updatePothole.mutate({ id, data: { is_fixed: true } }, {
      onSuccess: () => {
        toast({ title: "Marked as Repaired" });
        setSelectedMarker((m) => m ? { ...m, is_fixed: true } : m);
        queryClient.invalidateQueries({ queryKey: getListPotholesQueryKey({ dateRange: timeRange }) });
      },
    });
  };

  const statusConfig = {
    idle:       { label: "Offline",           color: "#475569" },
    acquiring:  { label: "Acquiring Target",   color: "var(--violet-fg)" },
    processing: { label: "Analysing Imagery",  color: "#fbbf24" },
    detected:   { label: "Anomaly Confirmed",  color: "#34d399" },
  };
  const sc = statusConfig[scanStatus];

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row overflow-hidden">
      {/* ── Map ── */}
      <div className="flex-1 min-h-[42vh] md:min-h-0 relative">
        <div ref={mapContainer} className="absolute inset-0 z-0" />

        {/* Time range pill */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-1 p-1 rounded-2xl" style={{ background: "var(--surface-popover)", backdropFilter: "blur(16px)", border: "1px solid var(--border-input)" }}>
            <Calendar size={13} className="text-muted-foreground ml-2" />
            {TIME_TABS.map((t) => (
              <button key={t.value} onClick={() => setTimeRange(t.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                style={timeRange === t.value
                  ? { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white", boxShadow: "0 2px 12px rgba(124,58,237,0.4)" }
                  : { color: "#64748b" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* OSM data status / zoom hint */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px]"
            style={{ background: "var(--surface-popover)", backdropFilter: "blur(8px)", border: "1px solid var(--border-card)" }}>
            {mapZoom < 9 ? (
              <>
                <Globe size={11} className="text-muted-foreground" />
                <span className="text-muted-foreground">Zoom in further to load OSM live data</span>
              </>
            ) : isFetchingOsm ? (
              <>
                <div className="w-2 h-2 rounded-full bg-violet-400 pulse-scan" />
                <span className="text-violet-400">Fetching global OSM data…</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-teal-400" />
                <span className="text-teal-400">{osmPotholes.length} OSM road-damage records</span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 z-10 rounded-xl p-3"
          style={{ background: "var(--surface-popover)", backdropFilter: "blur(8px)", border: "1px solid var(--border-card)" }}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">Map Legend</p>
          {[
            { color: "#f43f5e", label: "Critical (SkyMap DB)", fill: true },
            { color: "#fb923c", label: "High (SkyMap DB)", fill: true },
            { color: "#fbbf24", label: "Medium (SkyMap DB)", fill: true },
            { color: "#34d399", label: "Low (SkyMap DB)", fill: true },
            { color: "#f43f5e", label: "Pothole (OSM live)", fill: false },
            { color: "#fb923c", label: "Road damage (OSM live)", fill: false },
          ].map(({ color, label, fill }) => (
            <div key={label} className="flex items-center gap-2 mb-1 last:mb-0">
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: fill ? color : "transparent", border: `2px solid ${color}`, flexShrink: 0 }} />
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Side Panel ── */}
      <motion.div initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full md:w-80 lg:w-96 md:h-full overflow-y-auto flex flex-col z-20 shrink-0"
        style={{ background: "var(--surface-sidebar)", backdropFilter: "blur(24px)", borderTop: "1px solid var(--border-section)", borderLeft: "1px solid var(--border-section)" }}>
        <div className="p-4 space-y-4">

          {/* === POTHOLE DETAIL (when marker clicked) === */}
          <AnimatePresence>
            {selectedMarker && (
              <PotholeDetailPanel
                marker={selectedMarker}
                onClose={() => setSelectedMarker(null)}
                onMarkFixed={handleMarkFixed}
              />
            )}
          </AnimatePresence>

          {/* === SATELLITE SCANNER === */}
          <div className="rounded-2xl overflow-hidden gradient-border" style={{ background: "var(--surface-1)" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-section)" }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                  <Satellite size={12} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-foreground">Satellite Scanner</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.color, boxShadow: `0 0 6px ${sc.color}` }} />
                <span className="text-[10px] font-medium" style={{ color: sc.color }}>{sc.label}</span>
              </div>
            </div>
            <div className="relative bg-[#060810]" style={{ aspectRatio: "16/10" }}>
              <canvas ref={satCanvasRef} width={384} height={240} className="w-full h-full object-cover" />
              {isScanning && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "rgba(139,92,246,0.15)" }}>
                  <div className="h-full transition-all duration-75" style={{ width: `${scanProgress * 100}%`, background: "linear-gradient(90deg, #7c3aed, #818cf8)" }} />
                </div>
              )}
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: "rgba(6,8,16,0.88)", backdropFilter: "blur(4px)" }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.1))", border: "1px solid rgba(167,139,250,0.2)" }}>
                    <Satellite size={22} className="text-violet-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Satellite link offline</p>
                  <button onClick={() => setIsScanning(true)}
                    className="btn-gradient flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold">
                    <Scan size={14} /> Initiate Scan
                  </button>
                </div>
              )}
              {isScanning && (
                <button onClick={() => { setIsScanning(false); setScanStatus("idle"); setLastDetection(null); }}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)", color: "#fb7185" }}>
                  Abort
                </button>
              )}
            </div>
            {isScanning && (
              <div className="grid grid-cols-3" style={{ borderTop: "1px solid var(--border-section)" }}>
                {[{ label: "Azimuth", value: `${orbitPos.az.toFixed(1)}°` }, { label: "Elevation", value: `${orbitPos.el.toFixed(1)}°` }, { label: "Signal", value: `${signalStrength.toFixed(0)}%` }].map(({ label, value }) => (
                  <div key={label} className="text-center py-2.5 border-r border-white/5 last:border-0">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">{label}</p>
                    <p className="text-xs font-mono font-semibold gradient-text">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* === DEPTH ANALYSIS (from scan) === */}
          <AnimatePresence>
            {lastDetection && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)" }}>
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-section)" }}>
                    <div className="flex items-center gap-2">
                      <Layers size={13} className="text-teal-400" />
                      <span className="text-xs font-semibold">Depth Analysis</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[120px]">
                      {lastDetection.address ?? `${lastDetection.lat.toFixed(4)}, ${lastDetection.lon.toFixed(4)}`}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="relative h-14 rounded-xl overflow-hidden" style={{ background: "var(--surface-input)" }}>
                      <canvas ref={lidarCanvasRef} width={300} height={56} className="w-full h-full" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 pointer-events-none" />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-right">
                        <p className="text-[8px] text-muted-foreground uppercase mb-0.5">Max Depth</p>
                        <p className="text-sm font-mono font-bold gradient-text-teal">{lastDetection.depth_cm}cm</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Width", value: `${lastDetection.width_cm} cm` },
                        { label: "Volume", value: `${lastDetection.volume_m3} m³` },
                        { label: "Severity", value: lastDetection.severity, gradient: severityGradient(lastDetection.severity) },
                        { label: "Repair", value: fmt(lastDetection.estimated_repair_cost_usd), color: "#fb923c" },
                      ].map(({ label, value, gradient, color }) => (
                        <div key={label} className="p-2.5 rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
                          <p className="text-[9px] text-muted-foreground uppercase mb-1">{label}</p>
                          {gradient ? <p className="text-xs font-bold" style={{ background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{value}</p>
                            : <p className="text-xs font-mono font-semibold" style={{ color: color || "inherit" }}>{value}</p>}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-1.5"><Zap size={10} className="text-violet-400" /><span className="text-[9px] text-muted-foreground uppercase">Confidence</span></div>
                        <span className="text-[10px] font-bold gradient-text">{Math.round(lastDetection.confidence * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-section)" }}>
                        <div className="h-full rounded-full" style={{ width: `${lastDetection.confidence * 100}%`, background: "linear-gradient(90deg, #7c3aed, #818cf8, #38bdf8)" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* === ROUTING === */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)" }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-section)" }}>
              <RouteIcon size={13} className="text-teal-400" />
              <span className="text-sm font-semibold">Route Planner</span>
            </div>
            <div className="p-4">
              <form onSubmit={handleRoute} className="space-y-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Origin</Label>
                  <Input placeholder="Current location" className="h-9 text-sm rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 block">Destination</Label>
                  <div className="flex gap-2">
                    <Input placeholder="City Hall, Times Square…" value={routeEnd} onChange={(e) => setRouteEnd(e.target.value)}
                      className="h-9 text-sm rounded-xl flex-1" style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }} />
                    <button type="submit" disabled={getRoute.isPending}
                      className="btn-gradient-teal h-9 w-9 rounded-xl flex items-center justify-center shrink-0">
                      <Search size={14} />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* === NETWORK STATS === */}
          {stats && driverScore && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-section)" }}>
                <Activity size={13} className="text-violet-400" />
                <span className="text-sm font-semibold">Network Overview</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: "SkyMap DB", value: stats.total_potholes, gradient: "linear-gradient(135deg, #a78bfa, #818cf8)" },
                    { label: "OSM Global", value: osmPotholes.length + "+", gradient: "linear-gradient(135deg, #38bdf8, #06b6d4)" },
                    { label: "Repaired", value: stats.total_fixed, gradient: "linear-gradient(135deg, #34d399, #059669)" },
                    { label: "Est. Cost", value: `$${stats.total_repair_cost_usd.toLocaleString()}`, gradient: "linear-gradient(135deg, #fb923c, #ea580c)" }].map(({ label, value, gradient }) => (
                    <div key={label} className="p-3 rounded-xl" style={{ background: "var(--surface-input)", border: "1px solid var(--border-faint)" }}>
                      <p className="text-[9px] text-muted-foreground uppercase mb-1">{label}</p>
                      <p className="text-xl font-bold font-mono" style={{ background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(79,70,229,0.06))", border: "1px solid rgba(167,139,250,0.15)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5"><Shield size={12} className="text-violet-400" /><span className="text-xs font-semibold">Road Credit Score</span></div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(167,139,250,0.3)", color: "var(--violet-fg)" }}>{driverScore.level}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--border-section)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(driverScore.score / driverScore.next_level_threshold) * 100}%`, background: "linear-gradient(90deg, #7c3aed, #818cf8)" }} />
                  </div>
                  <div className="flex justify-between">
                    <p className="text-[9px] text-muted-foreground">{driverScore.score} / {driverScore.next_level_threshold} XP</p>
                    <div className="flex items-center gap-1"><TrendingUp size={9} className="text-teal-400" /><p className="text-[9px] text-teal-400 font-semibold">Saved {fmt(driverScore.city_savings_usd, true)}</p></div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
