import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useGetStatsSummary, useGetHeatmapData, useListPotholes, useGetDriverScore,
  useGetDashboardDetailedStats,
  getGetStatsSummaryQueryKey, getGetHeatmapDataQueryKey, getListPotholesQueryKey, getGetDriverScoreQueryKey,
} from "@/api";
import { 
  Activity, DollarSign, Layers, Map as MapIcon, TrendingUp, Zap, 
  AlertTriangle, Globe, BarChart2, Award, Users, CheckCircle2,
  Calendar, Shield, ChevronRight, Info, AlertCircle
} from "lucide-react";
import { useCurrency } from "@/context/currency";
import { useTheme } from "@/context/theme";
import { SEVERITY_COLOR, type Severity } from "@/data/hotspots";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart, Bar, Cell 
} from "recharts";

const TIME_TABS = [
  { value: "24h" as const, label: "24H" },
  { value: "week" as const, label: "Week" },
  { value: "month" as const, label: "Month" },
  { value: "all" as const, label: "All Time" },
];

function severityColor(sev: string) {
  return SEVERITY_COLOR[sev as Severity] ?? "#94a3b8";
}

const DARK_MAP_FILTER = "invert(1) hue-rotate(180deg) brightness(0.6) saturate(0.45) contrast(1.1)";

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<"24h" | "week" | "month" | "all">("all");
  const { fmt } = useCurrency();
  const { isDark } = useTheme();
  const isDarkMapRef = useRef(isDark);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { data: stats } = useGetStatsSummary({ query: { queryKey: getGetStatsSummaryQueryKey() } });
  const { data: dashboardStats, isError, error: apiError } = useGetDashboardDetailedStats();
  const { data: heatmapData } = useGetHeatmapData({ dateRange: timeRange }, { query: { queryKey: getGetHeatmapDataQueryKey({ dateRange: timeRange }) } });
  const { data: recentPotholes } = useListPotholes({ dateRange: "all" }, { query: { queryKey: getListPotholesQueryKey({ dateRange: "all" }) } });
  const { data: driverScore } = useGetDriverScore({ query: { queryKey: getGetDriverScoreQueryKey() } });
  
  useEffect(() => {
    console.log("[Dashboard] Connection Status:", { statsReady: !!stats, dashReady: !!dashboardStats, isError, apiError });
  }, [stats, dashboardStats, isError, apiError]);

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Infrastructure Pipeline Offline</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          {apiError instanceof Error ? apiError.message : "The real-time analytics stream is currently unreachable."}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-500 transition-colors"
        >
          Re-establish Connection
        </button>
      </div>
    );
  }

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatMarkersRef = useRef<L.CircleMarker[]>([]);

  useEffect(() => { isDarkMapRef.current = isDark; }, [isDark]);
  useEffect(() => {
    const pane = mapContainer.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
    if (pane) pane.style.filter = isDark ? DARK_MAP_FILTER : "none";
  }, [isDark]);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    const map = L.map(mapContainer.current, { center: [41.8781, -87.6298], zoom: 3, zoomControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 }).addTo(map);
    const applyFilter = () => {
      const pane = mapContainer.current?.querySelector<HTMLElement>(".leaflet-tile-pane");
      if (pane) pane.style.filter = isDarkMapRef.current ? DARK_MAP_FILTER : "none";
    };
    applyFilter();
    const obs = new MutationObserver(applyFilter);
    obs.observe(mapContainer.current, { childList: true, subtree: true });
    mapRef.current = map;
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!mapRef.current || !heatmapData) return;
    heatMarkersRef.current.forEach((m) => m.remove());
    heatMarkersRef.current = [];
    if (heatmapData.length > 0) {
      // Don't auto-fit map on every heat update if we want a global view
      // const bounds = L.latLngBounds(heatmapData.map(d => [d.lat, d.lon]));
      // mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
    const weights = (heatmapData || []).map((d) => d.weight).filter(w => !isNaN(w));
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 1;
    heatmapData.forEach((point) => {
      const norm = point.weight / maxWeight;
      let color: string;
      if (norm < 0.33) color = `rgba(139,92,246,0.65)`;
      else if (norm < 0.66) color = `rgba(251,146,60,0.7)`;
      else color = `rgba(244,63,94,0.8)`;
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: 4 + norm * 12, fillColor: color, color: color, weight: 0, fillOpacity: 0.6,
      }).addTo(mapRef.current!);
      heatMarkersRef.current.push(marker);
    });
  }, [heatmapData]);

  const kpis = [
    {
      label: "Global Hotspots",
      sub: `${dashboardStats?.top_cities?.length ?? 0} cities tracked`,
      value: dashboardStats?.top_cities?.length ?? 0,
      color: "#a855f7",
      bg: isDark ? "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0.02) 100%)" : "linear-gradient(135deg, #f4ebff 0%, #f0e6ff 100%)",
      border: isDark ? "rgba(168,85,247,0.2)" : "rgba(168,85,247,0.15)",
      icon: <Globe size={18} strokeWidth={2} />,
      trend: `+ 4 this month`,
    },
    {
      label: "Global Repair Cost",
      sub: "Estimated global deficit",
      value: fmt(dashboardStats?.cost_trend?.reduce((sum: number, c: any) => sum + c.cost, 0) || stats?.total_repair_cost_usd || 0),
      color: "#fb923c",
      bg: isDark ? "linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(251,146,60,0.02) 100%)" : "linear-gradient(135deg, #fff3e6 0%, #ffede0 100%)",
      border: isDark ? "rgba(251,146,60,0.2)" : "rgba(251,146,60,0.15)",
      icon: <DollarSign size={18} strokeWidth={2} />,
      trend: `↑ 12% YoY`,
    },
    {
      label: "SkyMap DB Records",
      sub: "Satellite confirmed",
      value: stats?.total_potholes ?? 0,
      color: "#34d399",
      bg: isDark ? "linear-gradient(135deg, rgba(52,211,153,0.15) 0%, rgba(52,211,153,0.02) 100%)" : "linear-gradient(135deg, #e6fdf2 0%, #dbfceb 100%)",
      border: isDark ? "rgba(52,211,153,0.2)" : "rgba(52,211,153,0.15)",
      icon: <Layers size={18} strokeWidth={2} />,
      trend: `${stats?.high_severity ?? 0} critical`,
    },
    {
      label: "DB Repair Liability",
      sub: "Local estimated cost",
      value: fmt(stats?.total_repair_cost_usd ?? 0),
      color: "#fb7185",
      bg: isDark ? "linear-gradient(135deg, rgba(251,113,133,0.15) 0%, rgba(251,113,133,0.02) 100%)" : "linear-gradient(135deg, #ffedf0 0%, #ffe3e8 100%)",
      border: isDark ? "rgba(251,113,133,0.2)" : "rgba(251,113,133,0.15)",
      icon: <AlertTriangle size={18} strokeWidth={2} />,
      trend: `${fmt(stats?.total_repair_cost_usd ?? 0)} total`,
    },
  ];

  if (renderError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4 text-center bg-red-500/5">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-xl font-bold">Rendering Logic Crash</h2>
        <div className="p-4 rounded-xl bg-black/40 border border-red-500/20 text-xs font-mono text-left max-w-2xl overflow-auto">
           {renderError.stack || renderError.message}
        </div>
        <button onClick={() => window.location.reload()} className="px-6 py-2 rounded-xl bg-red-600 text-white text-xs font-bold">Reset Interface</button>
      </div>
    );
  }

  const isSyncing = !stats || !dashboardStats;

  try {
    return (
      <div className="flex-1 min-h-0 p-5 md:p-7 overflow-y-auto w-full max-w-7xl mx-auto space-y-7">
        {/* Sync overlay removed based on user request */}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                <TrendingUp size={15} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold gradient-text">Global Analytics</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-11">Real-time infrastructure intelligence across world regions</p>
          </div>
          <div className="hidden md:flex items-center gap-1 p-0.5 rounded-xl shrink-0" style={{ background: "var(--surface-input)" }}>
            {TIME_TABS.map((t) => (
              <button key={t.value} onClick={() => setTimeRange(t.value)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200"
                style={timeRange === t.value
                  ? { background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white" }
                  : { color: "#64748b" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, sub, value, color, bg, border, icon, trend }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
            <div className="rounded-[24px] p-6 relative flex flex-col h-[180px]" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/40 dark:bg-black/20" style={{ color: color }}>
                  {icon}
                </div>
              </div>
              
              <div className="text-[34px] font-bold leading-none mb-2" style={{ color: color }}>
                {value}
              </div>
              
              <h3 className="text-[13px] font-bold text-foreground mb-0.5">
                {label}
              </h3>
              
              <p className="text-[11px] text-muted-foreground/80 mb-2">
                {sub}
              </p>
              
              <div className="mt-auto">
                <p className="text-[10px] font-semibold text-muted-foreground">
                  {trend}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Regional Breakdown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Globe size={15} style={{ color: "var(--violet-fg)" }} />
              <span className="text-sm font-semibold text-foreground">Regional Breakdown</span>
            </div>
            
            <Tabs defaultValue="Asia" className="w-auto">
              <TabsList className="bg-transparent border-0 gap-2">
                {["Asia", "Africa", "Americas", "Europe", "Oceania"].map(r => (
                  <TabsTrigger key={r} value={r} className="rounded-full text-[10px] px-4 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                    {r}
                  </TabsTrigger>
                ))}
              </TabsList>

              {["Asia", "Africa", "Americas", "Europe", "Oceania"].map(r => (
                <TabsContent key={r} value={r} className="mt-6">
                  {dashboardStats?.regional_stats?.[r] ? (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                      {/* Regional Summary */}
                      <div className="md:col-span-4 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-violet-600/20 text-violet-400">
                             <span className="font-bold text-lg">{r[0]}</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">{r}</h3>
                            <p className="text-[10px] text-muted-foreground">{dashboardStats?.regional_stats?.[r]?.city_count ?? 0} cities tracked</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl p-4 bg-black/[0.03] dark:bg-[#111425]/50 border border-black/5 dark:border-white/5">
                            <p className="text-3xl font-black text-orange-400">{fmt(dashboardStats?.regional_stats?.[r]?.total_cost ?? 0)}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total Cost</p>
                          </div>
                          <div className="rounded-xl p-4 bg-black/[0.03] dark:bg-[#111425]/50 border border-black/5 dark:border-white/5">
                            <p className="text-3xl font-black text-violet-400">{dashboardStats?.regional_stats?.[r]?.avg_severity ?? 0} / 4</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Avg Severity</p>
                          </div>
                          <div className="rounded-xl p-4 bg-black/[0.03] dark:bg-[#111425]/50 border border-black/5 dark:border-white/5">
                            <p className="text-3xl font-black text-red-400">{dashboardStats?.regional_stats?.[r]?.critical_count ?? 0}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold text-red-400/80">Critical</p>
                          </div>
                          <div className="rounded-xl p-4 bg-black/[0.03] dark:bg-[#111425]/50 border border-black/5 dark:border-white/5">
                            <p className="text-3xl font-black text-orange-400">{dashboardStats?.regional_stats?.[r]?.high_count ?? 0}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold text-orange-400/80">High</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {(dashboardStats?.regional_stats?.[r]?.severity_distribution || []).map((d: any) => (
                            <div key={d.label} className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-muted-foreground">{d.label}</span>
                                <span className="text-foreground">{d.percentage}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${d.percentage}%`, background: severityColor(d.label) }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Top Cities in Region */}
                      <div className="md:col-span-4">
                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Top Cities by Damage</h4>
                        <div className="space-y-4">
                          {(dashboardStats?.regional_stats?.[r]?.top_cities || []).map((city: any, idx: number) => (
                            <div key={city.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-muted-foreground/40">#{idx+1}</span>
                                <div className="w-2 h-2 rounded-full" style={{ background: severityColor(city.severity) }} />
                                <div>
                                  <p className="text-xs font-bold text-foreground">{city.name}</p>
                                  <p className="text-[9px] text-muted-foreground">{r} · {city.severity}</p>
                                </div>
                              </div>
                              <span className="text-xs font-mono font-bold text-orange-400">{fmt(city.cost)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Infrastructure Notes */}
                      <div className="md:col-span-4">
                        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Infrastructure Notes</h4>
                        <div className="space-y-4">
                          {(dashboardStats?.regional_stats?.[r]?.notes || []).map((note: any) => (
                            <div key={note.city} className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05] relative overflow-hidden">
                              <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[8px] font-black uppercase" style={{ background: `${severityColor(note.severity)}22`, color: severityColor(note.severity), border: `1px solid ${severityColor(note.severity)}44` }}>
                                {note.severity}
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: severityColor(note.severity) }} />
                                <span className="text-[11px] font-bold text-foreground">{note.city}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-relaxed">{note.note}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-muted-foreground text-sm">No telemetry for this region yet</div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Global Severity Distribution */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-6">
              <BarChart2 size={15} style={{ color: "var(--violet-fg)" }} />
              <span className="text-sm font-semibold text-foreground">Global Severity Distribution</span>
            </div>

            <div className="space-y-6">
              {(dashboardStats?.severity_distribution || []).map((d: any) => (
                <div key={d.label} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs font-bold text-foreground">{d.label}</span>
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground">
                      <span className="text-foreground">{d.count} cities</span> ({d.percentage}%)
                    </div>
                  </div>
                  <div className="h-2 w-full bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} animate={{ width: `${d.percentage}%` }} transition={{ duration: 0.8 }}
                      className="h-full rounded-full" style={{ background: d.color }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/5">
                <h5 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Repair Cost by Region</h5>
                <div className="space-y-4">
                  {Object.entries(dashboardStats?.regional_stats || {}).map(([name, data]: [string, any]) => (
                    <div key={name} className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground font-bold">{name}</span>
                        <span className="text-violet-400 font-black">{fmt(data.total_cost)}</span>
                      </div>
                      <div className="h-1 w-full bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, (data.total_cost / (dashboardStats?.cost_trend?.[0]?.cost || 1)) * 50)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        </motion.div>

        {/* Top 10 Damage Cities */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} style={{ color: "#fb7185" }} />
                <span className="text-sm font-semibold text-foreground">Top 10 Damage Cities</span>
              </div>
              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Ranked by estimated cost</span>
            </div>

            <div className="space-y-1">
              {(dashboardStats?.top_cities || []).map((city: any, idx: number) => (
                <div key={city.name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-black text-muted-foreground/30 w-4">{idx + 1}</span>
                    <div className="w-1.5 h-6 rounded-full" style={{ background: severityColor(city.severity) }} />
                    <div>
                      <p className="text-xs font-bold text-foreground group-hover:text-violet-400 transition-colors">{city.name}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-tight">{city.region}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-orange-400 font-mono">{fmt(city.cost)}</p>
                    <div className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter inline-block" style={{ background: `${severityColor(city.severity)}22`, color: severityColor(city.severity) }}>
                      {city.severity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Repair Cost Trend */}
        <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="rounded-2xl p-6 flex flex-col h-full" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-card)" }}>
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <Activity size={15} style={{ color: "var(--violet-fg)" }} />
                  <span className="text-sm font-semibold text-foreground">Repair Cost Trend (12 Months)</span>
                </div>
                <div className="flex items-center gap-4 text-[9px] font-bold text-muted-foreground">
                   <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500" /> Actual</div>
                   <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-400 opacity-50" /> Projected</div>
                </div>
             </div>
             
             <div className="flex-1 min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardStats?.cost_trend || []}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb923c" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `$${(v || 0)/1000}k`} />
                    <RechartsTooltip 
                      contentStyle={{ background: isDark ? "#111425" : "#ffffff", border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)", borderRadius: "12px", fontSize: "11px", color: isDark ? "#fff" : "#000" }}
                      itemStyle={{ fontWeight: "bold" }}
                    />
                    <Area type="monotone" dataKey="cost" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                    <Area type="monotone" dataKey="projected" stroke="#fb923c" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorProjected)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
        </motion.div>

        {/* Improved Driver Score */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="rounded-2xl p-6 h-full flex flex-col gap-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2">
              <Award size={15} style={{ color: "var(--violet-fg)" }} />
              <span className="text-sm font-semibold text-foreground">Driver Score</span>
            </div>
            
            {driverScore ? (
              <div className="space-y-6 flex-1 flex flex-col justify-center">
                <div className="flex flex-col items-center py-4">
                  <div className="relative w-36 h-36 mb-4">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="44" fill="none" stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} strokeWidth="6" />
                      <motion.circle 
                        cx="50" cy="50" r="44" fill="none"
                        stroke="url(#scoreGrad)" strokeWidth="8" strokeLinecap="round"
                        initial={{ strokeDasharray: "0 276.5" }}
                        animate={{ strokeDasharray: `${(driverScore.score / (driverScore.next_level_threshold || 1000)) * 276.5} 276.5` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                      <defs>
                        <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#38bdf8" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black gradient-text">{driverScore.score}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Credits</span>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="px-3 py-1 rounded-full bg-violet-600/20 border border-violet-500/30 inline-block mb-1">
                      <span className="text-xs font-black text-violet-400 uppercase tracking-widest">{driverScore.level}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1.5">
                       <Shield size={10} className="text-emerald-400" /> {driverScore.badge} Verified
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                   <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <Activity size={12} className="text-violet-400" />
                        <span className="text-[10px] font-bold text-muted-foreground">Reports</span>
                      </div>
                      <span className="text-xs font-black text-foreground">{driverScore.potholes_reported}</span>
                   </div>
                   <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-muted-foreground">Trust Rank</span>
                      </div>
                      <span className="text-xs font-black text-emerald-400">Top 4%</span>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 opacity-30">
                 <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mb-4" />
                 <p className="text-xs font-bold uppercase tracking-widest">Loading Operator Profile</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Heatmap Section */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="rounded-2xl overflow-hidden h-full flex flex-col" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--border-section)" }}>
            <MapIcon size={15} style={{ color: "var(--violet-fg)" }} />
            <span className="text-sm font-semibold text-foreground">Active Anomaly Heatmap</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{heatmapData?.length ?? 0} active data points</span>
          </div>
          <div className="h-[400px] relative">
            <div ref={mapContainer} className="absolute inset-0" />
            <div className="absolute bottom-4 right-4 p-3 rounded-xl bg-white/90 dark:bg-[#0a0d1c]/80 backdrop-blur-md border border-black/10 dark:border-white/10 z-[1000] text-[10px] space-y-2 text-foreground">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" /> Critical Severity
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-400" /> High Sensitivity
               </div>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400" /> Background Noise
               </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Live Feed Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
         <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--border-section)" }}>
              <Zap size={15} className="text-orange-400" />
              <span className="text-sm font-semibold text-foreground">Infrastructure Telemetry Stream</span>
              <div className="ml-auto flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                 <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">System Live</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/5 dark:bg-white/[0.02]">
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Anomly Type</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Location</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pipeline Source</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPotholes?.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-t border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-center inline-block" style={{ background: `${severityColor(p.severity)}22`, color: severityColor(p.severity), border: `1px solid ${severityColor(p.severity)}33` }}>
                           {p.severity}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                            <Activity size={10} className="text-muted-foreground" />
                            <span className="text-xs font-bold text-foreground">Infrastructure Anomaly</span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-1.5">
                            <MapIcon size={10} className="text-violet-400" />
                            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{p.address || "Geo-coordinate Link"}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-[10px] font-mono text-muted-foreground">{p.id.split('-')[0].toUpperCase()} / SYNC</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <span className="text-xs font-black text-orange-400 font-mono">{fmt(p.estimated_repair_cost_usd)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
         </div>
      </motion.div>
      </div>
    );
  } catch (err) {
    setRenderError(err as Error);
    return null;
  }
}
