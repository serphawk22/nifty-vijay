import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || "demo";

// In-memory cache: map of `symbol_range` -> { quote, chart, ts }
const cache: Record<string, { quote: any; chart: any; ts: number }> = {};
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min cache to protect rate limits

// Tracks symbols where the API is known rate-limited; skip live calls for 1 hour
const rateLimitedUntil: Record<string, number> = {};
const RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

async function fetchAV(params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, apikey: AV_KEY }).toString();
  const res = await fetch(`https://www.alphavantage.co/query?${qs}`, { cache: "no-store" });
  const json = await res.json();
  // If rate limited, retry with demo key
  if (json?.Information || json?.Note) {
    const qs2 = new URLSearchParams({ ...params, apikey: "demo" }).toString();
    const res2 = await fetch(`https://www.alphavantage.co/query?${qs2}`, { cache: "no-store" });
    return res2.json();
  }
  return json;
}

// ─── Mock Data Fallback ──────────────────────────────────────────────────────
function generateMockData(symbol: string, range: string, basePrice?: number) {
  const isUp = Math.random() > 0.4;
  const price = basePrice || (symbol === "AAPL" ? 185.92 : symbol === "TSLA" ? 172.63 : symbol === "NVDA" ? 875.21 : 100 + Math.random() * 200);
  const change = (Math.random() * 2 * (isUp ? 1 : -1)); // Smaller change for more realism
  const changePercent = (change / price) * 100;
  
  const quote = {
    symbol,
    price,
    open: price - (Math.random() * 1),
    high: price + (Math.random() * 1.5),
    low: price - (Math.random() * 1.5),
    prevClose: price - change,
    change,
    changePercent: changePercent.toFixed(2),
    volume: 1500000 + Math.floor(Math.random() * 5000000),
    latestTradingDay: new Date().toISOString().split("T")[0],
  };

  const chart = [];
  const isIntraday = range === "1d";
  const days = range === "5y" ? 260 : range === "1y" ? 250 : range === "6m" ? 125 : range === "3m" ? 60 : isIntraday ? 78 : 30; // 78 points for 5min intraday (~6.5 hrs)
  let currP = price - (change * (isIntraday ? 0.3 : 1.5));
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    if (range === "5y") d.setDate(now.getDate() - (i * 7));
    else if (isIntraday) {
      d.setMinutes(now.getMinutes() - (i * 5));
    } else d.setDate(now.getDate() - i);
    
    currP += (Math.random() - 0.48) * (price * (isIntraday ? 0.003 : 0.012));
    chart.push({
      time: isIntraday 
        ? d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
        : d.toISOString().split("T")[0],
      price: currP,
      open: currP * 0.995,
      high: currP * 1.005,
      low: currP * 0.992,
      close: currP,
      volume: Math.floor(Math.random() * (isIntraday ? 50000 : 800000)),
    });
  }

  return { quote, chart };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "1m";

  try {
    const now = Date.now();
    const cacheKey = `${symbol}_${range}`;
    const cached = cache[cacheKey];

    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(
        { success: true, symbol, quote: cached.quote, chart: cached.chart, cached: true },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // ── Check if symbol is known rate-limited ─────────────────────────────────
    if (rateLimitedUntil[symbol] && now < rateLimitedUntil[symbol]) {
      console.log(`[US Stock API] ${symbol} is rate-limited; serving mock without API call.`);
      const mock = generateMockData(symbol, range);
      cache[cacheKey] = { quote: mock.quote, chart: mock.chart, ts: now };
      return NextResponse.json(
        { success: true, symbol, ...mock, isMock: true },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // ── 1. Global Quote ──────────────────────────────────────────────────────
    const quoteJson = await fetchAV({ function: "GLOBAL_QUOTE", symbol });
    const q = quoteJson["Global Quote"] || {};

    if (!q["01. symbol"]) {
      console.warn(`[US Stock API] Rate limit or Not Found for ${symbol}. Caching mock data.`);
      // Mark this symbol as rate-limited so we skip API calls for the next hour
      rateLimitedUntil[symbol] = now + RATE_LIMIT_COOLDOWN_MS;
      const mock = generateMockData(symbol, range);
      // Cache mock data per range so we don't hit the API again
      cache[cacheKey] = { quote: mock.quote, chart: mock.chart, ts: now };
      return NextResponse.json(
        { success: true, symbol, ...mock, isMock: true },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const quote = {
      symbol: q["01. symbol"],
      price: parseFloat(q["05. price"]) || 0,
      open: parseFloat(q["02. open"]) || 0,
      high: parseFloat(q["03. high"]) || 0,
      low: parseFloat(q["04. low"]) || 0,
      prevClose: parseFloat(q["08. previous close"]) || 0,
      change: parseFloat(q["09. change"]) || 0,
      changePercent: q["10. change percent"]?.replace("%", "") || "0",
      volume: parseInt(q["06. volume"]) || 0,
      latestTradingDay: q["07. latest trading day"] || "",
    };

    // ── 2. Historical Candles ────────────────────────────────────────────────
    let avFunction = "TIME_SERIES_DAILY";
    let outputSize = "compact";

    if (range === "5y") avFunction = "TIME_SERIES_WEEKLY";
    else if (range === "1d") avFunction = "TIME_SERIES_INTRADAY";
    else if (range === "1y" || range === "6m") outputSize = "full";

    const fetchParams: any = { function: avFunction, symbol, outputsize: outputSize };
    if (range === "1d") fetchParams.interval = "5min";

    const histJson = await fetchAV(fetchParams);
    const timeSeriesKey = Object.keys(histJson).find(k => k.startsWith("Time Series") || k.startsWith("Weekly"));
    const timeSeries: Record<string, any> = histJson[timeSeriesKey || ""] || {};

    let entries = Object.entries(timeSeries)
      .map(([date, val]: [string, any]) => ({
        time: date,
        price: parseFloat(val["4. close"]),
        open: parseFloat(val["1. open"]),
        high: parseFloat(val["2. high"]),
        low: parseFloat(val["3. low"]),
        close: parseFloat(val["4. close"]),
        volume: parseInt(val["5. volume"] || val["6. volume"] || "0"),
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    // Filter by range
    const cutoff = new Date();
    if (range === "1d") {
      cutoff.setHours(cutoff.getHours() - 24);
      // For intraday, format time to HH:MM for the chart
      entries = entries.map(e => ({ ...e, time: e.time.split(" ")[1]?.substring(0, 5) || e.time }));
    } else if (range === "1m") cutoff.setMonth(cutoff.getMonth() - 1);
    else if (range === "3m") cutoff.setMonth(cutoff.getMonth() - 3);
    else if (range === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
    else if (range === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
    else if (range === "5y") cutoff.setFullYear(cutoff.getFullYear() - 5);
    else cutoff.setMonth(cutoff.getMonth() - 1);

    const chart = entries.filter(e => {
        if (range === "1d") return true; // Intraday usually comes pre-filtered for latest days
        return new Date(e.time) >= cutoff;
    });

    // If chart is empty but quote worked, generate mock chart based on quote
    if (chart.length === 0) {
       const mockChart = generateMockData(symbol, range, quote.price).chart;
       cache[cacheKey] = { quote, chart: mockChart, ts: now };
       return NextResponse.json(
         { success: true, symbol, quote, chart: mockChart, isMockChart: true },
         { headers: { "Cache-Control": "no-store, max-age=0" } }
       );
    }

    cache[cacheKey] = { quote, chart, ts: now };
    return NextResponse.json(
      { success: true, symbol, quote, chart },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("[US Stock API Error]", error);
    const mock = generateMockData(symbol, range);
    return NextResponse.json(
      { success: true, symbol, ...mock, isMock: true, error: error.message },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
