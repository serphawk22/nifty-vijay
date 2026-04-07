"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, ArrowDownRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSocket } from "@/hooks/use-socket";

const INDICES_IN = [
  { name: "NIFTY 50", symbol: "NIFTY 50", price: "25,807.20", currency: "INR", change: "-0.57%", trending: "down" },
  { name: "SENSEX", symbol: "SENSEX", price: "83,674.92", currency: "INR", change: "-0.66%", trending: "down" },
  { name: "NIFTY BANK", symbol: "NIFTY BANK", price: "60,739.75", currency: "INR", change: "-0.01%", trending: "down" },
  { name: "MIDCAP 100", symbol: "NIFTY MIDCAP 100", price: "60,470.85", currency: "INR", change: "-0.47%", trending: "down" },
  { name: "SMALLCAP 100", symbol: "NIFTY SMLCAP 100", price: "17,344.10", currency: "INR", change: "-0.64%", trending: "down" },
  { name: "NIFTY FIN", symbol: "NIFTY FIN SERVICE", price: "28,385.20", currency: "INR", change: "+0.38%", trending: "up" },
];

const INDICES_US = [
  { name: "S&P 500", symbol: "SPY", price: "0.00", currency: "USD", change: "0.00%", trending: "up" },
  { name: "NASDAQ", symbol: "QQQ", price: "0.00", currency: "USD", change: "0.00%", trending: "up" },
  { name: "DOW JONES", symbol: "DIA", price: "0.00", currency: "USD", change: "0.00%", trending: "up" },
  { name: "RUSSELL 2000", symbol: "IWM", price: "0.00", currency: "USD", change: "0.00%", trending: "up" },
];

// generateSimulatedData was removed. Time series fetched natively via TwelveData.
export function MarketSummary({ region = "in" }: { region?: "us" | "in" }) {
  const { socket, isConnected } = useSocket();
  const mainSymbol = useMemo(() => region === "us" ? "SPY" : "NIFTY 50", [region]);
  const currencySymbol = region === "us" ? "$" : "₹";
  const currencyCode = region === "us" ? "USD" : "INR";
  
  const [indices, setIndices] = useState(region === "us" ? INDICES_US : INDICES_IN);
  const [data, setData] = useState<any[]>([]); 
  const [currentPrice, setCurrentPrice] = useState(0);
  const [change, setChange] = useState({ value: 0, percent: 0 });
  const [hoveredData, setHoveredData] = useState<any>(null);

  // isPositive is always derived from data (first vs last point) for correct chart color.
  // displayPercent prefers the official change.percent from the quotes API;
  // falls back to computing from data only while quotes are still loading (change.percent === 0).
  const { isPositive, displayPercent } = useMemo(() => {
    // Standard market practice: Positivity is based on the official daily change (Current vs Prev Close)
    const pos = change.percent >= 0;
    const pct = change.percent;
    return { isPositive: pos, displayPercent: pct };
  }, [change.percent]);

  const chartColor = isPositive ? "#22c55e" : "#ef4444";
  const gradientId = `colorValue_${isPositive ? "up" : "down"}`;

  // Initial Fetch Data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        if (region === "us") {
          const res = await fetch("/api/stocks/quotes?symbols=SPY,QQQ,DIA,IWM");
          const json = await res.json();
          if (json.success && json.data) {
            const upds = json.data;
            setIndices(prev => prev.map(idx => {
              const u = upds.find((x: any) => x.symbol === idx.symbol);
              if (u) {
                return {
                  ...idx,
                  price: (u.last_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                  change: `${u.change >= 0 ? "+" : ""}${(u.change_percent || 0).toFixed(2)}%`,
                  trending: u.change >= 0 ? "up" : "down"
                };
              }
              return idx;
            }));
            
            const spyQuote = upds.find((x: any) => x.symbol === "SPY");
            if (spyQuote) {
               setCurrentPrice(spyQuote.last_price);
               setChange({ value: spyQuote.change, percent: spyQuote.change_percent });
               // Fetch 1-day 5-minute interval historical data from Twelve Data
               const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
               if (apiKey) {
                 try {
                   // outputsize=78 covers roughly one 6.5 hour trading day (390 mins / 5 = 78)
                   const tsRes = await fetch(`https://api.twelvedata.com/time_series?symbol=SPY&interval=5min&outputsize=78&apikey=${apiKey}`);
                   const tsJson = await tsRes.json();
                   if (tsJson.status === "ok" && Array.isArray(tsJson.values)) {
                     // Reverse because TwelveData returns newest first
                     const reversed = [...tsJson.values].reverse();
                     const chartData = reversed.map((item: any) => {
                       const d = new Date(item.datetime);
                       // We'll format the time for US timezone if requested or just local
                       // Twelve Data returns datetime in US format (usually NY time or UTC depending on zone params)
                       // Assuming it returns string like "2024-05-10 09:30:00"
                       const timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                       return {
                         time: timeString,
                         value: parseFloat(item.close)
                       };
                     });
                     setData(chartData);
                   }
                 } catch (err) {
                   console.warn("Failed to fetch twelve data time series:", err);
                 }
               }
            }
          }
        } else {
          // Indian Data — fetch chart data and official quotes in parallel
          const [histRes] = await Promise.all([
            fetch("/api/stocks/NIFTY%2050/historical?range=1d")
          ]);
          if (histRes.ok) {
            const json = await histRes.json();
            if (Array.isArray(json) && json.length > 0) {
              const chartData = json.map((item: any) => ({
                time: item.time,
                value: item.price
              }));
              setData(chartData);
              // Set price from historical for fast initial render;
              // change/percent will be overwritten by the official quotes API below
              const latestPrice = json[json.length - 1].close || json[json.length - 1].price;
              setCurrentPrice(latestPrice);
            }
          }

          const allIndSymbols = INDICES_IN.map(i => i.symbol).join(",");
          const quotesRes = await fetch(`/api/stocks/quotes?symbols=${encodeURIComponent(allIndSymbols)}`);
          const quotesJson = await quotesRes.json();
          if (quotesJson.success && quotesJson.data) {
            setIndices(prev => prev.map(idx => {
              const q = quotesJson.data.find((x: any) => x.symbol === idx.symbol);
              if (!q) return idx;
              return {
                ...idx,
                price: (q.last_price || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
                change: `${q.change_percent >= 0 ? "+" : ""}${q.change_percent.toFixed(2)}%`,
                trending: q.change_percent >= 0 ? "up" : "down"
              };
            }));

            // Use NIFTY 50's official change_percent from quotes API as the single source of truth
            const niftyQuote = quotesJson.data.find((x: any) => x.symbol === "NIFTY 50");
            if (niftyQuote) {
              setCurrentPrice(niftyQuote.last_price);
              setChange({ value: niftyQuote.change, percent: niftyQuote.change_percent });
            }
          }
        }
      } catch (err) {
        console.error(`Failed to fetch ${region} data`, err);
      }
    };
    fetchInitialData();
  }, [region]);

  // Socket Live Updates
  useEffect(() => {
    if (!socket) return;

    const handleIndexUpdate = (update: { symbol: string; price: number; change?: number; percent?: number; timestamp: string }) => {
      // 1. Update Main Chart Data (only for SPY or NIFTY 50 depending on region)
      if (update.symbol === mainSymbol) {
        setCurrentPrice(update.price);
        if (update.change !== undefined && update.percent !== undefined && update.percent !== 0) {
          setChange({ value: update.change, percent: update.percent });
        }

        setData(prev => {
          const timeZone = region === "us" ? "America/New_York" : "Asia/Kolkata";
          const now = new Date();
          const timeLabel = now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone
          });

          // Use numeric time for market hours check
          const [hStr, mStr] = timeLabel.split(':');
          const h = parseInt(hStr, 10);
          const m = parseInt(mStr, 10);
          const minuteOfDay = h * 60 + m;

          // Market Hours Check
          const marketOpen = region === "us" ? (9 * 60 + 30) : (9 * 60 + 15);
          const marketClose = region === "us" ? (16 * 60) : (15 * 60 + 30);

          if (minuteOfDay < marketOpen || minuteOfDay >= marketClose) {
            if (prev.length === 0) return prev;
            return [...prev.slice(0, -1), { ...prev[prev.length - 1], value: update.price }];
          }

          const newPoint = { time: timeLabel, value: update.price };
          if (prev.length === 0) return [newPoint];

          const last = prev[prev.length - 1];
          if (last.time === timeLabel) {
            return [...prev.slice(0, -1), { ...last, value: update.price }];
          }

          const updated = [...prev, newPoint];
          return updated.length > 400 ? updated.slice(-400) : updated;
        });
      }

      // 2. Update Sidebar Indices list
      setIndices(prevIndices => {
        return prevIndices.map(index => {
          if (index.symbol === update.symbol) {
            const loc = region === "us" ? 'en-US' : 'en-IN';
            const hasRealPercent = update.percent !== undefined && update.percent !== 0;
            return { 
              ...index, 
              price: update.price.toLocaleString(loc, { minimumFractionDigits: 2 }),
              // Only update change/trending if socket sends a real non-zero percent;
              // otherwise keep the value fetched from the quotes API at load time.
              ...(hasRealPercent ? {
                change: `${update.percent! >= 0 ? "+" : ""}${update.percent!.toFixed(2)}%`,
                trending: update.percent! >= 0 ? "up" : "down"
              } : {})
            };
          }
          return index;
        });
      });
    };

    socket.on("index-update", handleIndexUpdate);
    return () => { socket.off("index-update", handleIndexUpdate); };
  }, [socket, region, mainSymbol]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Chart Section */}
      <div className="flex-1 p-8 rounded-3xl bg-card border border-border relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex bg-muted rounded-full p-1 pr-4 items-center gap-3 border border-border">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
              region === "us" ? "bg-red-600" : "bg-blue-600"
            )}>
              {region === "us" ? "SP" : "50"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold">{region === "us" ? "S&P 500" : "Nifty 50"}</span>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{mainSymbol}</span>
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  isConnected ? "bg-green-500" : "bg-red-500 animate-pulse"
                )} title={isConnected ? "Live Connected" : "Connecting..."} />
              </div>
            </div>
          </div>
        </div>

        {/* Price & Change */}
        <div className="mb-8">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-foreground tracking-tight">
              {currentPrice.toLocaleString(region === 'us' ? 'en-US' : 'en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-lg text-muted-foreground font-medium">{currencyCode}</span>
            <span className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold ml-2",
              isPositive ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
            )}>
              {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {isPositive ? "+" : "-"}{Math.abs(displayPercent).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Area Chart */}
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} onMouseMove={(e: any) => { if (e.activePayload) setHoveredData(e.activePayload[0].payload) }} onMouseLeave={() => setHoveredData(null)}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                minTickGap={40}
                dy={12}
              />
              <YAxis
                hide
                domain={[
                  (dataMin: number) => dataMin - (dataMin * 0.002),
                  (dataMax: number) => dataMax + (dataMax * 0.002)
                ]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  padding: '8px 12px'
                }}
                itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '12px', marginBottom: '4px' }}
                cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                formatter={(value: any) => [`${currencySymbol}${Number(value).toLocaleString(region === 'us' ? 'en-US' : 'en-IN', { minimumFractionDigits: 2 })}`, 'Price']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                activeDot={{
                  r: 5,
                  fill: chartColor,
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right Sidebar: Major Indices */}
      <div className="w-full lg:w-96 p-6 rounded-3xl bg-card border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-6">Major indices</h3>
        <div className="space-y-4">
          {indices.map((index) => (
            <Link key={index.name} href={`/indices/${encodeURIComponent(index.symbol)}`}>
              <div className="flex items-center justify-between group hover:bg-muted p-2 rounded-xl transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-border",
                    index.name.includes("S&P") || index.name === "NIFTY 50" ? "bg-blue-600 text-white" :
                      index.name.includes("DOW") || index.name === "SENSEX" ? "bg-purple-600 text-white" :
                        index.name.includes("NASDAQ") || index.name === "NIFTY BANK" ? "bg-green-600 text-white" :
                          index.name.includes("RUSSELL") || index.name === "NIFTY FIN" ? "bg-yellow-600 text-white" :
                            "bg-muted text-muted-foreground"
                  )}>
                    {index.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">{index.name}</span>
                      {index.currency !== (region === 'us' ? "USD" : "INR") && <span className="text-[10px] bg-muted text-muted-foreground px-1 rounded">{index.currency}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{index.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">
                    {index.currency === "USD" ? "$" : "₹"}{index.price}
                  </div>
                  <div className={cn(
                    "text-xs font-medium flex items-center justify-end gap-1",
                    index.trending === "up" ? "text-green-500" : "text-red-500"
                  )}>
                    {index.change}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/indices">
          <button className="w-full mt-6 py-2 text-sm text-primary hover:text-primary/80 transition-colors text-left flex items-center gap-1">
            See all major Indices <ArrowUpRight className="h-3 w-3" />
          </button>
        </Link>
      </div>
    </div>
  );
}
