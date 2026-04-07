"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Globe, TrendingUp, TrendingDown, RefreshCw,
  Search, ChevronUp, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

const REGIONS = [
  { id: "us",     label: "United States", flag: "🇺🇸" },
  { id: "europe", label: "Europe",         flag: "🇪🇺" },
  { id: "asia",   label: "Asia & Pacific", flag: "🌏" },
  { id: "uk",     label: "United Kingdom", flag: "🇬🇧" },
];

function formatCurrency(n: number | null, currency = "USD", compact = false): string {
  if (n == null) return "—";
  const sym = currency === "GBp" ? "p" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : currency === "JPY" ? "¥" : currency === "KRW" ? "₩" : currency === "HKD" ? "HK$" : "$";
  if (compact) {
    if (n >= 1e12) return `${sym}${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${sym}${(n / 1e6).toFixed(2)}M`;
  }
  return `${sym}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVolume(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n}`;
}

function WorldStocksContent() {
  const searchParams = useSearchParams();
  const initialRegion = searchParams.get("region") || "us";
  const [region, setRegion] = useState(initialRegion);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [regionLabel, setRegionLabel] = useState("United States");

  const fetchData = useCallback(async (r: string, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/world-stocks/quotes?region=${r}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setRegionLabel(json.regionLabel);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error("Failed to fetch world stocks", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(region);
  }, [region, fetchData]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const sorted = [...data]
    .filter(d => {
      const q = search.toLowerCase();
      return d.name?.toLowerCase().includes(q) || d.symbol?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const av = a[sortBy] ?? -Infinity;
      const bv = b[sortBy] ?? -Infinity;
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ChevronUp className="h-3 w-3 opacity-20" />;
    return sortDir === "desc" ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />;
  };

  const gainers = data.filter(d => d.change_percent > 0).length;
  const losers = data.filter(d => d.change_percent < 0).length;
  const totalMarketCap = data.reduce((acc, d) => acc + (d.market_cap || 0), 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Globe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">World Stocks</h1>
                <p className="text-sm text-muted-foreground">Global equity markets — live prices</p>
              </div>
            </div>
            <button
              onClick={() => fetchData(region, true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Refresh"}
            </button>
          </div>

          {/* Region Tabs */}
          <div className="flex gap-2 mt-5 flex-wrap">
            {REGIONS.map(r => (
              <button
                key={r.id}
                onClick={() => { setRegion(r.id); setSearch(""); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  region === r.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
                )}
              >
                <span>{r.flag}</span>
                <span>{r.label}</span>
              </button>
            ))}
          </div>

          {/* Stats */}
          {!loading && (
            <div className="grid grid-cols-3 gap-4 mt-5">
              {[
                { label: "Total Market Cap", value: formatCurrency(totalMarketCap, "USD", true), icon: <Globe className="h-4 w-4 text-blue-400" /> },
                { label: "Gainers", value: `${gainers}`, icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, color: "text-emerald-400" },
                { label: "Losers", value: `${losers}`, icon: <TrendingDown className="h-4 w-4 text-rose-400" />, color: "text-rose-400" },
              ].map(stat => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {stat.icon}
                    {stat.label}
                  </div>
                  <div className={cn("text-lg font-bold", stat.color)}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${regionLabel} stocks...`}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-muted/40 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-muted-foreground text-sm">Fetching {regionLabel} stocks...</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort("price")}>
                      <div className="flex items-center justify-end gap-1">Price <SortIcon col="price" /></div>
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground" onClick={() => toggleSort("change_percent")}>
                      <div className="flex items-center justify-end gap-1">Change % <SortIcon col="change_percent" /></div>
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground hidden md:table-cell" onClick={() => toggleSort("market_cap")}>
                      <div className="flex items-center justify-end gap-1">Market Cap <SortIcon col="market_cap" /></div>
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell cursor-pointer hover:text-foreground" onClick={() => toggleSort("volume")}>
                      <div className="flex items-center justify-end gap-1">Volume <SortIcon col="volume" /></div>
                    </th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell cursor-pointer hover:text-foreground" onClick={() => toggleSort("pe_ratio")}>
                      <div className="flex items-center justify-end gap-1">P/E <SortIcon col="pe_ratio" /></div>
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Exchange</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((stock, idx) => {
                    const isPositive = stock.change_percent >= 0;
                    const initials = (stock.name || stock.symbol).slice(0, 2).toUpperCase();
                    const colors = ["from-blue-500 to-cyan-500", "from-purple-500 to-pink-500", "from-green-500 to-emerald-500", "from-orange-500 to-amber-500", "from-red-500 to-rose-500"];
                    const colorClass = colors[idx % colors.length];

                    return (
                      <tr key={stock.symbol} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 bg-gradient-to-br",
                              colorClass
                            )}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-foreground truncate max-w-[180px]">{stock.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{stock.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {formatCurrency(stock.price, stock.currency)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-md",
                            isPositive ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                          )}>
                            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {isPositive ? "+" : ""}{stock.change_percent?.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs hidden md:table-cell">
                          {formatCurrency(stock.market_cap, "USD", true)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs hidden lg:table-cell">
                          {formatVolume(stock.volume)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground font-mono text-xs hidden xl:table-cell">
                          {stock.pe_ratio ? stock.pe_ratio.toFixed(1) : "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {stock.exchange || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sorted.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">
                  No stocks found matching &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground/60 text-center mt-4">
          Data sourced from Yahoo Finance. Prices may be delayed 15-20 minutes.
        </p>
      </div>
    </div>
  );
}

export default function WorldStocksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <WorldStocksContent />
    </Suspense>
  );
}
