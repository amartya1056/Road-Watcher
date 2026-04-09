import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Map, LayoutDashboard, List, Radio, ChevronDown, Bot, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency, CURRENCIES } from "@/context/currency";
import { useTheme } from "@/context/theme";

function CurrencySelector() {
  const { currency, setCurrencyCode } = useCurrency();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
        style={isDark
          ? { color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)", background: "transparent" }
          : { color: "#6d28d9", border: "1px solid rgba(109,40,217,0.15)", background: "rgba(109,40,217,0.04)" }}
      >
        <span className="text-sm leading-none">{currency.flag}</span>
        <span className="hidden lg:inline flex-1 text-left">
          {currency.code} — {currency.symbol}
        </span>
        <ChevronDown size={12} className={cn("hidden lg:block transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-52 rounded-2xl overflow-hidden z-[9999]"
          style={{
            background: "var(--surface-popover)",
            border: "1px solid var(--border-input)",
            backdropFilter: "blur(16px)",
            boxShadow: "var(--shadow-popover)",
          }}
        >
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Display Currency</p>
          </div>
          <div className="overflow-y-auto max-h-64 py-1">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => { setCurrencyCode(c.code); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left"
                style={c.code === currency.code
                  ? { background: isDark ? "rgba(124,58,237,0.2)" : "rgba(109,40,217,0.08)", color: isDark ? "#a78bfa" : "#5b21b6" }
                  : { color: isDark ? "#94a3b8" : "#64748b" }}
                onMouseEnter={(e) => { if (c.code !== currency.code) e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)"; }}
                onMouseLeave={(e) => { if (c.code !== currency.code) e.currentTarget.style.background = "transparent"; }}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="text-[11px] font-semibold">{c.code}</span>
                <span className="text-[10px] text-muted-foreground truncate">{c.name}</span>
                <span className="ml-auto text-[11px] font-mono" style={{ color: c.code === currency.code ? (isDark ? "#a78bfa" : "#5b21b6") : "#94a3b8" }}>{c.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { toggle, isDark } = useTheme();

  const navItems = [
    { href: "/", icon: Map, label: "Command Center", shortLabel: "Map" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Analytics", shortLabel: "Analytics" },
    { href: "/potholes", icon: List, label: "Pothole Log", shortLabel: "Log" },
    { href: "/ai", icon: Bot, label: "RoadWatch AI", shortLabel: "AI" },
  ];

  const sidebarBg = isDark ? "hsl(228 26% 4%)" : "hsl(210 40% 98%)";
  const borderColor = "var(--border-section)";

  return (
    <div className="h-dvh bg-background text-foreground flex overflow-hidden font-sans">

      {/* ── Desktop Sidebar (hidden on mobile) ─────────────────────────────── */}
      <nav
        className="hidden md:flex w-16 lg:w-64 h-full border-r flex-col shrink-0 z-50 transition-colors duration-300"
        style={{ background: sidebarBg, borderColor }}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b" style={{ borderColor }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #6d28d9 0%, #4338ca 50%, #0369a1 100%)" }}>
            <Radio size={16} className="text-white" />
          </div>
          <div className="hidden lg:flex flex-col leading-none">
            <span className="font-bold text-sm tracking-wide gradient-text">Roadview</span>
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">Pothole Intelligence</span>
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col gap-1 p-2 md:p-3 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="outline-none block">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group whitespace-nowrap relative overflow-hidden",
                  isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                )}>
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl"
                      style={{
                        background: isDark
                          ? "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(79,70,229,0.2) 100%)"
                          : "linear-gradient(135deg, rgba(109,40,217,0.1) 0%, rgba(67,56,202,0.08) 100%)",
                        border: isDark ? "1px solid rgba(167,139,250,0.25)" : "1px solid rgba(109,40,217,0.18)",
                      }} />
                  )}
                  <item.icon size={18} className={cn(
                    "relative z-10 shrink-0 transition-colors",
                    isActive ? (isDark ? "text-violet-400" : "text-violet-700") : "group-hover:text-violet-500"
                  )} />
                  <span className={cn(
                    "hidden lg:inline-block text-sm font-medium relative z-10",
                    isActive ? (isDark ? "text-violet-200" : "text-violet-800") : ""
                  )}>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Theme Toggle */}
        <div className="hidden lg:flex items-center justify-between px-4 py-3 border-t" style={{ borderColor }}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {isDark ? "Dark Mode" : "Light Mode"}
          </span>
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
            style={isDark
              ? { background: "rgba(124,58,237,0.15)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }
              : { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Currency Selector */}
        <div className="hidden lg:block px-3 py-2 border-t" style={{ borderColor }}>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">Currency</p>
          <CurrencySelector />
        </div>

        {/* Bottom status */}
        <div className="hidden lg:flex items-center px-4 py-3 border-t" style={{ borderColor }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.7)" }} />
            <span className="text-xs text-muted-foreground">System Online</span>
          </div>
        </div>
      </nav>

      {/* ── Mobile + Main Column ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">

        {/* Mobile-only top header */}
        <header
          className="md:hidden flex items-center justify-between px-4 shrink-0 border-b"
          style={{
            background: sidebarBg,
            borderColor,
            height: 52,
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #6d28d9 0%, #4338ca 50%, #0369a1 100%)" }}>
              <Radio size={13} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm gradient-text">Roadview</span>
              <span className="text-[9px] text-muted-foreground tracking-widest uppercase">Pothole Intelligence</span>
            </div>
          </div>
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90"
            style={isDark
              ? { background: "rgba(124,58,237,0.15)", border: "1px solid rgba(167,139,250,0.25)", color: "#a78bfa" }
              : { background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#b45309" }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
          {children}
        </main>

        {/* Mobile-only bottom tab bar */}
        <nav
          className="md:hidden shrink-0 flex items-center border-t z-50"
          style={{
            background: sidebarBg,
            borderColor,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="flex-1 outline-none">
                <div className="flex flex-col items-center justify-center gap-1 py-2.5 relative">
                  {isActive && (
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{
                        width: 32,
                        height: 3,
                        background: "linear-gradient(90deg, #7c3aed, #4f46e5)",
                        borderRadius: "0 0 4px 4px",
                      }}
                    />
                  )}
                  <item.icon
                    size={21}
                    style={{
                      color: isActive ? (isDark ? "#a78bfa" : "#6d28d9") : (isDark ? "#64748b" : "#94a3b8"),
                      transition: "color 0.2s",
                    }}
                  />
                  <span
                    className="text-[10px] font-semibold"
                    style={{
                      color: isActive ? (isDark ? "#a78bfa" : "#6d28d9") : (isDark ? "#64748b" : "#94a3b8"),
                    }}
                  >
                    {item.shortLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
