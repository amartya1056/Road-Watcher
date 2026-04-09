import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CurrencyDef {
  code: string; symbol: string; name: string; rate: number; flag: string;
  decimals: number;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", symbol: "$",    name: "US Dollar",          rate: 1,        flag: "🇺🇸", decimals: 2 },
  { code: "EUR", symbol: "€",    name: "Euro",               rate: 0.91,     flag: "🇪🇺", decimals: 2 },
  { code: "GBP", symbol: "£",    name: "British Pound",      rate: 0.78,     flag: "🇬🇧", decimals: 2 },
  { code: "INR", symbol: "₹",    name: "Indian Rupee",       rate: 83.12,    flag: "🇮🇳", decimals: 0 },
  { code: "BRL", symbol: "R$",   name: "Brazilian Real",     rate: 4.97,     flag: "🇧🇷", decimals: 2 },
  { code: "NGN", symbol: "₦",    name: "Nigerian Naira",     rate: 1580,     flag: "🇳🇬", decimals: 0 },
  { code: "ZAR", symbol: "R",    name: "South African Rand", rate: 18.90,    flag: "🇿🇦", decimals: 2 },
  { code: "JPY", symbol: "¥",    name: "Japanese Yen",       rate: 154.50,   flag: "🇯🇵", decimals: 0 },
  { code: "AUD", symbol: "A$",   name: "Australian Dollar",  rate: 1.53,     flag: "🇦🇺", decimals: 2 },
  { code: "CAD", symbol: "C$",   name: "Canadian Dollar",    rate: 1.36,     flag: "🇨🇦", decimals: 2 },
  { code: "MXN", symbol: "$",    name: "Mexican Peso",       rate: 17.15,    flag: "🇲🇽", decimals: 2 },
  { code: "EGP", symbol: "E£",   name: "Egyptian Pound",     rate: 49.80,    flag: "🇪🇬", decimals: 2 },
  { code: "IDR", symbol: "Rp",   name: "Indonesian Rupiah",  rate: 16200,    flag: "🇮🇩", decimals: 0 },
  { code: "PHP", symbol: "₱",    name: "Philippine Peso",    rate: 56.05,    flag: "🇵🇭", decimals: 2 },
  { code: "KES", symbol: "KSh",  name: "Kenyan Shilling",    rate: 132.50,   flag: "🇰🇪", decimals: 0 },
  { code: "BDT", symbol: "৳",    name: "Bangladeshi Taka",   rate: 110.70,   flag: "🇧🇩", decimals: 0 },
  { code: "PKR", symbol: "₨",    name: "Pakistani Rupee",    rate: 278.50,   flag: "🇵🇰", decimals: 0 },
  { code: "CNY", symbol: "¥",    name: "Chinese Yuan",       rate: 7.24,     flag: "🇨🇳", decimals: 2 },
  { code: "AED", symbol: "د.إ",  name: "UAE Dirham",         rate: 3.67,     flag: "🇦🇪", decimals: 2 },
  { code: "KRW", symbol: "₩",    name: "South Korean Won",   rate: 1355,     flag: "🇰🇷", decimals: 0 },
];

interface CurrencyContextType {
  currency: CurrencyDef;
  setCurrencyCode: (code: string) => void;
  fmt: (usd: number, compact?: boolean) => string;
  convert: (usd: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: CURRENCIES[0],
  setCurrencyCode: () => {},
  fmt: (v) => `$${v.toFixed(2)}`,
  convert: (v) => v,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string>(() => {
    try { return localStorage.getItem("skymap_currency") ?? "USD"; } catch { return "USD"; }
  });

  const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];

  const setCurrencyCode = (c: string) => {
    setCode(c);
    try { localStorage.setItem("skymap_currency", c); } catch {}
  };

  const convert = (usd: number) => usd * currency.rate;

  const fmt = (usd: number, compact = false): string => {
    const val = convert(usd);
    if (compact) {
      if (val >= 1_000_000_000) return `${currency.symbol}${(val / 1_000_000_000).toFixed(1)}B`;
      if (val >= 1_000_000)     return `${currency.symbol}${(val / 1_000_000).toFixed(1)}M`;
      if (val >= 1_000)         return `${currency.symbol}${(val / 1_000).toFixed(1)}K`;
    }
    return `${currency.symbol}${val.toLocaleString(undefined, {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrencyCode, fmt, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
