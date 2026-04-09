import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useListPotholes, useUpdatePothole, getListPotholesQueryKey } from "@/api";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle, Loader2, Search, List, Filter, MapPin, FileText, X, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/context/currency";

function severityColor(sev: string) {
  if (sev === "Critical") return { bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.3)", text: "#fb7185" };
  if (sev === "High")     return { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)", text: "#fb923c" };
  if (sev === "Medium")   return { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.3)", text: "#fbbf24" };
  return { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)", text: "#34d399" };
}

type RoadType = "NH" | "SH" | "MDR" | "City Road" | "Rural Road" | "Unknown";

const AUTHORITY_MAP: Record<RoadType, string> = {
  NH: "NHAI / National Highways Authority",
  SH: "State Public Works Department (PWD)",
  MDR: "District Collector / District PWD",
  "City Road": "Municipal Corporation / Urban Local Body",
  "Rural Road": "Gram Panchayat / Rural Engineering Dept",
  Unknown: "Local Road Authority",
};

interface ComplaintModalProps {
  potholeId: string;
  potholeAddress: string | null;
  onClose: () => void;
}

function ComplaintModal({ potholeId, potholeAddress, onClose }: ComplaintModalProps) {
  const { toast } = useToast();
  const [type, setType] = useState<"complaint" | "report">("complaint");
  const [roadType, setRoadType] = useState<RoadType>("Unknown");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const authority = AUTHORITY_MAP[roadType];

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/potholes/${potholeId}/complaints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, road_type: roadType, authority, description, contact_name: contactName || undefined, contact_email: contactEmail || undefined }),
      });
      if (!res.ok) throw new Error("Failed to file complaint");
      toast({ title: type === "complaint" ? "Complaint filed!" : "Report submitted!", description: `Routed to: ${authority}` });
      onClose();
    } catch {
      toast({ title: "Failed to file", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
        style={{ background: "var(--surface-modal)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-card)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
              <FileText size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">File Complaint / Report</h2>
              <p className="text-[10px] text-muted-foreground">Pothole {potholeId.split("-")[0]}{potholeAddress ? ` · ${potholeAddress}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            {(["complaint", "report"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                style={type === t
                  ? { background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.25))", border: "1px solid rgba(167,139,250,0.4)", color: "var(--violet-fg)" }
                  : { background: "var(--surface-subtle)", border: "1px solid var(--border-card)", color: "#64748b" }}>
                {t === "complaint" ? "Formal Complaint" : "Report Issue"}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Road Type</label>
            <select value={roadType} onChange={(e) => setRoadType(e.target.value as RoadType)}
              className="w-full px-3 py-2 rounded-xl text-sm text-foreground outline-none"
              style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }}>
              {(["NH", "SH", "MDR", "City Road", "Rural Road", "Unknown"] as const).map((rt) => (
                <option key={rt} value={rt} style={{ background: "#0a0d1c" }}>{rt}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Routed to Authority</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--violet-fg)" }}>{authority}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description <span className="text-red-400">*</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} placeholder="Describe the road damage, hazards, and urgency…"
              className="w-full px-3 py-2 rounded-xl text-sm text-foreground resize-none outline-none placeholder:text-muted-foreground/50"
              style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Name</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-xl text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</label>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                type="email" placeholder="Optional"
                className="w-full px-3 py-2 rounded-xl text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }} />
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground transition-all hover:text-foreground"
            style={{ background: "var(--surface-hover)", border: "1px solid var(--border-card)" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || !description.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Potholes() {
  const { toast } = useToast();
  const { fmt } = useCurrency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [complaintPothole, setComplaintPothole] = useState<{ id: string; address: string | null } | null>(null);

  const queryParams: any = {};
  if (severityFilter !== "all") queryParams.severity = severityFilter;
  if (statusFilter !== "all") queryParams.is_fixed = statusFilter === "fixed";

  const { data: potholes, isLoading } = useListPotholes(queryParams, { query: { queryKey: getListPotholesQueryKey(queryParams) } });
  const updatePothole = useUpdatePothole();

  const handleToggleFixed = (id: string, currentFixed: boolean) => {
    updatePothole.mutate({ id, data: { is_fixed: !currentFixed } }, {
      onSuccess: () => {
        toast({ title: currentFixed ? "Marked as Active" : "Marked as Repaired", description: "Pothole status updated." });
        queryClient.invalidateQueries({ queryKey: getListPotholesQueryKey(queryParams) });
      },
    });
  };

  const filteredPotholes = potholes?.filter((p) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return p.id.toLowerCase().includes(s) ||
      (p.address && p.address.toLowerCase().includes(s)) ||
      String(p.lat).includes(s) ||
      String(p.lon).includes(s);
  }) ?? [];

  return (
    <div className="flex-1 min-h-0 p-6 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto space-y-8">

      <AnimatePresence>
        {complaintPothole && (
          <ComplaintModal
            key="complaint-modal"
            potholeId={complaintPothole.id}
            potholeAddress={complaintPothole.address}
            onClose={() => setComplaintPothole(null)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0d9488, #059669)" }}>
            <List size={15} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text-teal">Pothole Registry</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-11">Satellite-confirmed infrastructure anomaly database</p>
      </motion.div>

      {/* Table card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)" }}>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-section)" }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter size={14} className="text-violet-400" />
              <span>Filter Records</span>
              <span className="text-[10px] text-muted-foreground font-normal ml-1">({filteredPotholes.length} results)</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search ID, address or coords…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-sm rounded-xl w-full sm:w-56"
                  style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }}
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-9 rounded-xl text-sm w-full sm:w-36" style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }}>
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 rounded-xl text-sm w-full sm:w-32" style={{ background: "var(--surface-input)", border: "1px solid var(--border-input)" }}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="fixed">Repaired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Mobile card list (phones only) ── */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-violet-400" size={28} />
              </div>
            ) : filteredPotholes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground font-semibold">
                No records match your filters
              </div>
            ) : filteredPotholes.map((p, i) => {
              const sc = severityColor(p.severity);
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="rounded-2xl p-4 space-y-3"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border-card)" }}>
                  {/* Row 1: ID + severity + status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-muted-foreground/50">#</span>
                      <span className="font-mono text-sm font-black text-foreground">{p.id.split("-")[0].toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide"
                        style={{ background: sc.bg, border: `1.5px solid ${sc.border}`, color: sc.text }}>
                        {p.severity}
                      </span>
                      {p.is_fixed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black"
                          style={{ background: "rgba(52,211,153,0.12)", border: "1.5px solid rgba(52,211,153,0.3)", color: "#10b981" }}>
                          <CheckCircle2 size={11} /> Repaired
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black"
                          style={{ background: "rgba(251,113,133,0.12)", border: "1.5px solid rgba(251,113,133,0.3)", color: "#f43f5e" }}>
                          <AlertTriangle size={11} /> Active
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Row 2: Location */}
                  {p.address && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                      <MapPin size={11} className="text-violet-500 shrink-0" />
                      <span>{p.address}</span>
                    </div>
                  )}
                  {/* Row 3: Metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--surface-2)" }}>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Cost</p>
                      <p className="text-sm font-black font-mono" style={{ color: "#f97316" }}>{fmt(p.estimated_repair_cost_usd)}</p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--surface-2)" }}>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Depth</p>
                      <p className="text-sm font-black font-mono text-foreground">{p.depth_cm}<span className="text-[10px] font-semibold text-muted-foreground">cm</span></p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--surface-2)" }}>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-0.5">Conf.</p>
                      <p className="text-sm font-black font-mono" style={{ color: "var(--violet-fg)" }}>{Math.round(p.confidence * 100)}%</p>
                    </div>
                  </div>
                  {/* Row 4: Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleFixed(p.id, !!p.is_fixed)}
                      disabled={updatePothole.isPending}
                      className="flex-1 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95"
                      style={p.is_fixed
                        ? { background: "rgba(251,146,60,0.12)", border: "1.5px solid rgba(251,146,60,0.3)", color: "#f97316" }
                        : { background: "rgba(52,211,153,0.12)", border: "1.5px solid rgba(52,211,153,0.3)", color: "#10b981" }}>
                      {p.is_fixed ? "Mark Active" : "Mark Repaired"}
                    </button>
                    <button
                      onClick={() => setComplaintPothole({ id: p.id, address: p.address ?? null })}
                      className="flex-1 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95"
                      style={{ background: "rgba(124,58,237,0.12)", border: "1.5px solid rgba(124,58,237,0.3)", color: "var(--violet-fg)" }}>
                      File Complaint
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── Desktop table (hidden on phones) ── */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderBottom: "2px solid var(--border-card)" }} className="hover:bg-transparent">
                  {["ID", "Location", "Coordinates", "Severity", "Dimensions", "Repair Cost", "Confidence", "Status", "Detected", "Actions"].map((h) => (
                    <TableHead key={h} className="text-[11px] font-black uppercase tracking-widest py-4 text-foreground/60"
                      style={{ background: "var(--surface-2)", letterSpacing: "0.12em" }}>
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20">
                      <Loader2 className="animate-spin mx-auto text-violet-400" size={28} />
                    </TableCell>
                  </TableRow>
                ) : filteredPotholes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20 text-muted-foreground font-semibold">
                      No records match your filters
                    </TableCell>
                  </TableRow>
                ) : filteredPotholes.map((p, i) => {
                  const sc = severityColor(p.severity);
                  return (
                    <motion.tr key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.025 }}
                      className="transition-all duration-150 group"
                      style={{ borderBottom: "1px solid var(--border-faint)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>

                      {/* ID */}
                      <TableCell className="py-4 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-muted-foreground/50">#</span>
                          <span className="font-mono text-sm font-black text-foreground tracking-tight">
                            {p.id.split("-")[0].toUpperCase()}
                          </span>
                        </div>
                      </TableCell>

                      {/* Location */}
                      <TableCell className="py-4 min-w-[160px]">
                        {p.address ? (
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 leading-snug">
                            <MapPin size={10} className="text-violet-500 shrink-0" />
                            {p.address.length > 34 ? p.address.slice(0, 34) + "…" : p.address}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </TableCell>

                      {/* Coordinates */}
                      <TableCell className="py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[10px] font-bold text-foreground/80 tracking-tight">
                            {Number(p.lat).toFixed(5)}°N
                          </span>
                          <span className="font-mono text-[10px] font-bold text-foreground/80 tracking-tight">
                            {Number(p.lon).toFixed(5)}°E
                          </span>
                        </div>
                      </TableCell>

                      {/* Severity */}
                      <TableCell className="py-4">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase"
                          style={{ background: sc.bg, border: `1.5px solid ${sc.border}`, color: sc.text, letterSpacing: "0.08em" }}>
                          {p.severity}
                        </span>
                      </TableCell>

                      {/* Dimensions */}
                      <TableCell className="py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-black text-foreground">
                            D: <span className="font-mono">{p.depth_cm}</span><span className="text-muted-foreground text-[10px] font-semibold">cm</span>
                          </span>
                          <span className="text-xs font-black text-foreground">
                            W: <span className="font-mono">{p.width_cm}</span><span className="text-muted-foreground text-[10px] font-semibold">cm</span>
                          </span>
                        </div>
                      </TableCell>

                      {/* Repair Cost */}
                      <TableCell className="py-4">
                        <span className="text-sm font-black font-mono" style={{ color: "#f97316" }}>
                          {fmt(p.estimated_repair_cost_usd)}
                        </span>
                      </TableCell>

                      {/* Confidence */}
                      <TableCell className="py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-1.5 min-w-[80px]">
                          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border-card)" }}>
                            <motion.div className="h-full rounded-full"
                              initial={{ width: 0 }} animate={{ width: `${p.confidence * 100}%` }}
                              transition={{ duration: 0.7, delay: i * 0.02 }}
                              style={{ background: "linear-gradient(90deg, #7c3aed, #818cf8)" }} />
                          </div>
                          <span className="text-xs font-black font-mono text-foreground">{Math.round(p.confidence * 100)}%</span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-4">
                        {p.is_fixed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black"
                            style={{ background: "rgba(52,211,153,0.12)", border: "1.5px solid rgba(52,211,153,0.3)", color: "#10b981" }}>
                            <CheckCircle2 size={13} /> Repaired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-black"
                            style={{ background: "rgba(251,113,133,0.12)", border: "1.5px solid rgba(251,113,133,0.3)", color: "#f43f5e" }}>
                            <AlertTriangle size={13} /> Active
                          </span>
                        )}
                      </TableCell>

                      {/* Detected */}
                      <TableCell className="py-4 hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-foreground">{format(new Date(p.timestamp), "MMM d")}</span>
                          <span className="text-[10px] font-mono font-semibold text-muted-foreground">{format(new Date(p.timestamp), "HH:mm")}</span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-4 text-right pr-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleToggleFixed(p.id, !!p.is_fixed)}
                            disabled={updatePothole.isPending}
                            className="px-3 py-2 rounded-xl text-xs font-black transition-all duration-200 hover:opacity-85 hover:scale-105 active:scale-95"
                            style={p.is_fixed
                              ? { background: "rgba(251,146,60,0.12)", border: "1.5px solid rgba(251,146,60,0.3)", color: "#f97316" }
                              : { background: "linear-gradient(135deg, rgba(13,148,136,0.18), rgba(5,150,105,0.14))", border: "1.5px solid rgba(52,211,153,0.35)", color: "#10b981" }}>
                            {p.is_fixed ? "Mark Active" : "Mark Repaired"}
                          </button>
                          <button
                            onClick={() => setComplaintPothole({ id: p.id, address: p.address ?? null })}
                            className="px-3 py-2 rounded-xl text-xs font-black transition-all duration-200 hover:opacity-85 hover:scale-105 active:scale-95"
                            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(79,70,229,0.12))", border: "1.5px solid rgba(124,58,237,0.3)", color: "var(--violet-fg)" }}>
                            File Complaint
                          </button>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
