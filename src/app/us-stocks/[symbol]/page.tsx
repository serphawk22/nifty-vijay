"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Activity, ExternalLink } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { cn } from "@/lib/utils";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import { PriceAlertModal } from "@/components/PriceAlertModal";
const RANGES = [
  { label: "1D", value: "1d" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
];

function fmt(n: number, digits = 2) {
  return n?.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtCompact(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n?.toString();
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg text-sm">
        <p className="text-gray-500 text-xs mb-0.5">{label}</p>
        <p className="font-bold text-gray-900">${fmt(payload[0]?.value)}</p>
      </div>
    );
  }
  return null;
};

export default function UsStockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = (params.symbol as string)?.toUpperCase();
  const [data, setData] = useState<{ quote: any; chart: any[]; isMock?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("1d");
  const [chartLoading, setChartLoading] = useState(false);

  const fetchData = useCallback(async (r: string) => {
    try {
      setChartLoading(true);
      const res = await fetch(`/api/us-stocks/${encodeURIComponent(symbol)}?range=${r}&_v=${Date.now()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to fetch");
      setData({ quote: json.quote, chart: json.chart, isMock: json.isMock });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setChartLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (symbol) fetchData(range);
  }, [symbol, range, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading {symbol}...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Stock not found"}</p>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const { quote, chart, isMock } = data;

  // Calculate relative change based on chart range
  const firstPrice = chart.length > 0 ? chart[0].price : quote.prevClose;
  const currentPrice = quote.price;
  const rangeChange = currentPrice - firstPrice;
  const rangePercent = (rangeChange / firstPrice) * 100;
  const isPositive = rangeChange >= 0;
  const chartColor = isPositive ? "#ef4444" : "#ef4444"; // match screenshot — red
  const changeColor = isPositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600";
  const changeSign = isPositive ? "+" : "";

  // Compute chart domain
  const prices = chart.map(c => c.price).filter(Boolean);
  const minP = prices.length ? Math.min(...prices) * 0.998 : 0;
  const maxP = prices.length ? Math.max(...prices) * 1.002 : 0;

  const actualChartColor = isPositive ? "#22c55e" : "#ef4444";
  const gradientId = `usGrad_${symbol}`;

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <DashboardNavbar region="us" />

      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Back nav */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to US Stocks
        </button>

        {/* ── Main Chart Card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
          {/* Header */}
          <div className="mb-1">
            <h1 className="text-xl font-bold text-gray-900">{symbol}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>{symbol}</span>
              <span>•</span>
              <span>NYSE / NASDAQ</span>
              {isMock ? (
                <span className="flex items-center gap-1 text-amber-600 font-medium text-xs bg-amber-50 px-2 py-0.5 rounded-full">
                  <Activity className="h-3 w-3" /> Demo Data
                </span>
              ) : (
                <span className="flex items-center gap-1 text-green-600 font-medium text-xs bg-green-50 px-2 py-0.5 rounded-full">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>

          {/* Price + Change & Alert */}
          <div className="flex justify-between items-end mt-4 mb-2">
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-gray-900 tracking-tight">${fmt(quote.price)}</span>
              <span className={cn("flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full mb-1", changeColor)}>
                {isPositive ? "▲" : "▼"} {changeSign}{fmt(Math.abs(rangeChange))} ({changeSign}{Math.abs(rangePercent).toFixed(2)}%)
              </span>
            </div>
            <PriceAlertModal symbol={symbol} currentPrice={quote.price} />
          </div>

          {/* Chart */}
          <div className="relative">
            {chartLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl z-10">
                <div className="h-8 w-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            )}

            {chart.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
                <Activity className="h-5 w-5 mr-2" /> No chart data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chart} margin={{ top: 4, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={actualChartColor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={actualChartColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />
                  <YAxis
                    domain={[minP, maxP]}
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `$${v.toFixed(0)}`}
                    width={52}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={actualChartColor}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{ r: 4, fill: actualChartColor, stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Range Toggles */}
          <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-100">
            <div className="flex gap-1">
              {RANGES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    range === r.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => router.push("/all-us-stocks")}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-300 transition-all"
            >
              All US Stocks <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* ── Performance Card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            Performance
            <span className="text-gray-400 text-xs font-normal border border-gray-200 rounded-full h-4 w-4 flex items-center justify-center cursor-help" title="Key statistics for this stock">ⓘ</span>
          </h2>

          {/* Day range bar */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Today's Low</span>
              <span>Today's High</span>
            </div>
            <div className="relative h-1.5 bg-gray-100 rounded-full">
              {(() => {
                const range = quote.high - quote.low;
                const pct = range > 0 ? ((quote.price - quote.low) / range) * 100 : 50;
                return (
                  <>
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-400 to-green-400 rounded-full" style={{ width: `${pct}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-400 rounded-full shadow" style={{ left: `calc(${pct}% - 6px)` }} />
                  </>
                );
              })()}
            </div>
            <div className="flex justify-between text-sm font-semibold text-gray-800 mt-1.5">
              <span>{fmt(quote.low)}</span>
              <span>{fmt(quote.high)}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
            {[
              { label: "Open", value: `$${fmt(quote.open)}` },
              { label: "Prev. Close", value: `$${fmt(quote.prevClose)}` },
              { label: "Volume", value: fmtCompact(quote.volume) },
              { label: "Day Change", value: `${isPositive ? "+" : ""}${fmt(rangeChange)} (${changeSign}${rangePercent.toFixed(2)}%)`, highlight: isPositive },
              { label: "Exchange", value: "NYSE / NASDAQ" },
              { label: "Asset Type", value: "US Equity" },
            ].map(stat => (
              <div key={stat.label} className="flex flex-col gap-0.5 border-b border-gray-100 pb-3">
                <span className="text-xs text-gray-500">{stat.label}</span>
                <span className={cn("text-sm font-semibold text-gray-900", stat.highlight !== undefined && (stat.highlight ? "text-green-600" : "text-red-600"))}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
