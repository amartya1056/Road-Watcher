export type Region = "Asia" | "Africa" | "Americas" | "Europe" | "Oceania";
export type Severity = "Low" | "Medium" | "High" | "Critical";

export interface Hotspot {
  lat: number; lon: number; city: string; country: string;
  severity: Severity; note: string; region: Region;
  costUsd: number;
}

export const GLOBAL_HOTSPOTS: Hotspot[] = [];

// Severity numeric score for calculations
export const SEVERITY_SCORE: Record<Severity, number> = {
  Critical: 4, High: 3, Medium: 2, Low: 1,
};

export const SEVERITY_COLOR: Record<Severity, string> = {
  Critical: "#f43f5e", High: "#fb923c", Medium: "#fbbf24", Low: "#34d399",
};

export const REGION_META: Record<Region, { color: string; gradient: string; bg: string; border: string }> = {
  Asia:     { color: "#a78bfa", gradient: "linear-gradient(135deg,#a78bfa,#818cf8)", bg: "rgba(124,58,237,0.1)",   border: "rgba(167,139,250,0.25)" },
  Africa:   { color: "#fb923c", gradient: "linear-gradient(135deg,#fb923c,#ea580c)", bg: "rgba(251,146,60,0.1)",   border: "rgba(251,146,60,0.25)" },
  Americas: { color: "#38bdf8", gradient: "linear-gradient(135deg,#38bdf8,#0ea5e9)", bg: "rgba(56,189,248,0.1)",   border: "rgba(56,189,248,0.25)" },
  Europe:   { color: "#34d399", gradient: "linear-gradient(135deg,#34d399,#059669)", bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.25)" },
  Oceania:  { color: "#fbbf24", gradient: "linear-gradient(135deg,#fbbf24,#d97706)", bg: "rgba(251,191,36,0.1)",   border: "rgba(251,191,36,0.25)" },
};
