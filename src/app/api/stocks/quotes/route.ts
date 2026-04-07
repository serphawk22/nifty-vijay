import { kite } from "@/lib/kite";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NIFTY_50_SYMBOLS } from "@/lib/nifty50";

export const dynamic = "force-dynamic";

const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || "";

function isIndianStock(symbol: string): boolean {
  const s = symbol.toUpperCase().trim();
  
  // Explicitly exclude common US indices/ETFs to prevent them being caught in the generic fallback
  if (["SPY", "QQQ", "DIA", "IWM", "VOO", "IVV", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META"].includes(s)) {
    return false;
  }

  if (
    s.endsWith(".NS") || 
    s.endsWith(".BO") || 
    s.startsWith("NSE:") || 
    s.startsWith("BSE:") ||
    ["NIFTY 50", "NIFTY BANK", "SENSEX"].includes(s) ||
    NIFTY_50_SYMBOLS.includes(s)
  ) {
    return true;
  }
  return !s.includes(".") && s.length >= 2 && s.length <= 12;
}

function normalizeSymbol(symbol: string) {
  const base = symbol.split(":")[1] || symbol.split(".")[0] || symbol;
  const clean = base.toUpperCase().trim();
  return {
    base: clean,
    nse: `NSE:${clean}`,
    bse: `BSE:${clean}`,
    yahoo: `${clean}.NS`,
    avGlobal: `${clean}`, 
    avIndia: `${clean}.BSE`
  };
}

// Fetch live quote choosing the best API, using an already fetched batch for Kite
async function getLiveQuote(symbol: string, preFetchedKiteQuotes: any = {}) {
  const normalized = normalizeSymbol(symbol);
  const isIndian = isIndianStock(symbol);

  // 1. Kite (INDIAN ONLY)
  if (isIndian) {
    try {
      const q = preFetchedKiteQuotes[normalized.nse];
      const hasValidPrice = q && q.last_price > 0;
      const timestampStr = q.timestamp ? (typeof q.timestamp === "string" ? q.timestamp : new Date(q.timestamp).toISOString()) : "";
      const hasValidTime = q && q.timestamp && !timestampStr.startsWith("1970");

      if (hasValidPrice && hasValidTime) {
        const lastPrice = q.last_price;
        const ohlcClose = q.ohlc?.close;
        const ohlcOpen = q.ohlc?.open;

        // When ohlc.close === last_price, Kite hasn't provided a real previous close
        // (common for indices in mock/auth-invalid mode). Fall back to open price.
        const refPrice = (ohlcClose && Math.abs(ohlcClose - lastPrice) > 0.01)
          ? ohlcClose
          : ohlcOpen;

        const rawChange = refPrice ? lastPrice - refPrice : (q.net_change || 0);
        const changePercent = refPrice && refPrice > 0
          ? parseFloat(((rawChange / refPrice) * 100).toFixed(2))
          : 0;

        return {
          price: lastPrice,
          change: refPrice ? rawChange : (q.net_change || 0),
          changePercent,
          volume: q.volume || 0,
          source: "kite",
          ohlc: q.ohlc,
          timestamp: q.timestamp || new Date().toISOString()
        };
      }
    } catch (e) {
      console.warn(`[Kite extract] Failed for ${symbol}:`, (e as Error).message);
    }
  }

  // 2. Alpha Vantage (INDIAN OR GLOBAL)
  if (AV_KEY) {
    try {
      const avSymbol = isIndian ? `NSE:${normalized.base}` : normalized.avGlobal;
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSymbol}&apikey=${AV_KEY}`;
      const res = await fetch(url, { next: { revalidate: 60 } });
      const json = await res.json();
      const data = json["Global Quote"];
      
      if (data && data["05. price"]) {
        const price = parseFloat(data["05. price"]);
        const change = parseFloat(data["09. change"]);
        const changePct = parseFloat(data["10. change percent"].replace("%", ""));
        return {
          price,
          change,
          changePercent: changePct,
          volume: parseInt(data["06. volume"]),
          source: "alphavantage",
          ohlc: { close: price - change },
          timestamp: new Date().toISOString()
        };
      }
    } catch (e) {
      console.warn(`[Alpha Vantage] Failed for ${symbol}:`, (e as Error).message);
    }
  }

  // 3. Last Resort: Mock Data (For Dev/Demo)
  if (isIndian) {
    const symbolBaselines: Record<string, number> = {
      "TCS": 3950,
      "INFY": 1620,
      "RELIANCE": 2850,
      "HDFCBANK": 1540,
      "TATAMOTORS": 940,
      "WIPRO": 480,
      "ITC": 425,
      "BHARTIARTL": 1210,
      "SBIN": 760,
      "ICICIBANK": 1080,
      "KOTAKBANK": 1780,
      "LT": 3520,
      "AXISBANK": 1120,
      "MARUTI": 12500,
      "SUNPHARMA": 1640,
      "NIFTY 50": 22350,
      "SENSEX": 73500,
      "NIFTY BANK": 47500
    };

    const basePrice = symbolBaselines[normalized.base] || (500 + Math.random() * 2000);
    const randomChange = (Math.random() - 0.5) * (basePrice * 0.02); // 2% max change
    const currentPrice = basePrice + randomChange;
    const changePercent = (randomChange / basePrice) * 100;
    
    return {
      price: currentPrice,
      change: randomChange,
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000),
      source: "mock",
      ohlc: { open: basePrice, high: currentPrice + 5, low: currentPrice - 5, close: basePrice },
      timestamp: new Date().toISOString()
    };
  } else {
    // US / Global - Use Twelve Data API if available
    const tdKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;
    if (tdKey) {
      try {
        const url = `https://api.twelvedata.com/quote?symbol=${normalized.base}&apikey=${tdKey}`;
        const res = await fetch(url, { next: { revalidate: 60 } });
        const data = await res.json();
        
        // Twelve data returns status "error" if limit exceeded
        if (data && data.close) {
          const price = parseFloat(data.close);
          const previousClose = parseFloat(data.previous_close);
          const change = parseFloat(data.change);
          const changePercent = parseFloat(data.percent_change);
          
          return {
            price,
            change,
            changePercent,
            volume: parseInt(data.volume) || 0,
            source: "twelvedata",
            ohlc: { open: parseFloat(data.open), high: parseFloat(data.high), low: parseFloat(data.low), close: previousClose },
            timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString()
          };
        }
      } catch (e) {
        console.warn(`[Twelve Data] Failed for ${symbol}:`, (e as Error).message);
      }
    }

    // US Mock Emergency Fallback (If Twelve Data is rate limited or no API key)
    let mockPrice = 500;
    if (normalized.base === "SPY") mockPrice = 510;
    else if (normalized.base === "QQQ") mockPrice = 440;
    else if (normalized.base === "DIA") mockPrice = 390;
    else mockPrice = 100 + (symbol.length * 10);

    const randomChange = (Math.random() - 0.5) * 5;
    const randomPercent = (randomChange / mockPrice) * 100;

    return {
      price: mockPrice + randomChange,
      change: randomChange,
      changePercent: parseFloat(randomPercent.toFixed(2)),
      volume: 0,
      source: "mock-us",
      ohlc: { open: mockPrice, high: mockPrice + 2, low: mockPrice - 2, close: mockPrice },
      timestamp: new Date().toISOString()
    };
  }

  return null;
}

// Fetch fundamentals choosing the right API
async function getFundamentals(symbol: string) {
  const normalized = normalizeSymbol(symbol);
  const isIndian = isIndianStock(symbol);
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // 1. Try DB cache first
  try {
    const existing = await prisma.stockFundamental.findFirst({
      where: { symbol: normalized.base, date: todayUTC },
    });
    if (existing && existing.fiftyTwoWeekHigh) return { ...existing, source: "db" };
  } catch (e) {}

  // 2. Alpha Vantage (OVERVIEW has 52 Week High/Low)
  if (AV_KEY) {
    try {
      const avSymbol = isIndian ? normalized.avIndia : normalized.avGlobal;
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${avSymbol}&apikey=${AV_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      
      if (json.Name && json["52WeekHigh"]) {
        const data = {
          symbol: normalized.base,
          date: todayUTC,
          longName: json.Name,
          sector: json.Sector,
          marketCap: parseFloat(json.MarketCapitalization) || null,
          peRatio: parseFloat(json.TrailingPE) || null,
          eps: parseFloat(json.EPS) || null,
          dividendYield: parseFloat(json.DividendYield) || null,
          fiftyTwoWeekHigh: parseFloat(json["52WeekHigh"]) || null,
          fiftyTwoWeekLow: parseFloat(json["52WeekLow"]) || null,
          avgVolume10d: parseInt(json.SharesOutstanding) || null,
          lastUpdated: new Date()
        };
        
        try {
          await prisma.stockFundamental.upsert({
            where: { symbol_date: { symbol: normalized.base, date: todayUTC } },
            update: data,
            create: data
          });
        } catch (e) {}
        
        return { ...data, source: "alphavantage" };
      }
    } catch (e) {}
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols");

  if (!symbols || symbols.trim() === "" || symbols === "undefined") {
    return NextResponse.json({ success: true, data: [] });
  }

  const symbolsArray = symbols.split(",").map(s => s.trim().toUpperCase());

  // BATCH FETCH FROM KITE TO AVOID RATE LIMITS!
  const indianSymbols = symbolsArray.filter(isIndianStock).map(s => normalizeSymbol(s).nse);
  let preFetchedKiteQuotes: any = {};
  
  if (indianSymbols.length > 0) {
    try {
      // Fetch all Indian symbols in a single request! Max 500 per request allowed by Kite.
      preFetchedKiteQuotes = await (kite as any).getQuote(indianSymbols);
    } catch (err: any) {
      console.error("[Kite] Batch fetch failed:", err.message);
    }
  }

  try {
    const quotes = await Promise.all(symbolsArray.map(async (symbol) => {
      try {
        const quote = await getLiveQuote(symbol, preFetchedKiteQuotes);
        if (!quote) return null;

        const fundamentals = await getFundamentals(symbol);

        return {
          symbol: symbol.split(":")[1] || symbol,
          last_price: quote.price,
          change: quote.change,
          change_percent: quote.changePercent,
          volume: quote.volume,
          source: quote.source,
          timestamp: quote.timestamp,
          ohlc: quote.ohlc,
          
          longName: fundamentals?.longName || null,
          sector: fundamentals?.sector || null,
          market_cap: fundamentals?.marketCap || null,
          pe_ratio: fundamentals?.peRatio || null,
          eps: fundamentals?.eps || null,
          div_yield: fundamentals?.dividendYield || null,
          fifty_two_week_high: fundamentals?.fiftyTwoWeekHigh || null,
          fifty_two_week_low: fundamentals?.fiftyTwoWeekLow || null,
          average_volume_10d: fundamentals?.avgVolume10d || null
        };
      } catch (err) {
        console.error(`Error processing ${symbol}:`, err);
        return null;
      }
    }));

    const validQuotes = quotes.filter(q => q !== null);

    return NextResponse.json({
      success: true,
      data: validQuotes,
      count: validQuotes.length
    });
  } catch (error: any) {
    console.error("Critical API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stock data", details: error.message },
      { status: 500 }
    );
  }
}
