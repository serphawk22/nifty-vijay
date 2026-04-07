import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const WORLD_STOCK_GROUPS: Record<string, { label: string; flag: string; symbols: string[] }> = {
  us: {
    label: "United States",
    flag: "🇺🇸",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "JNJ"],
  },
  europe: {
    label: "Europe",
    flag: "🇪🇺",
    symbols: ["ASML", "SAP", "AZN", "HSBA.L", "VOW3.DE", "NVO", "MC.PA", "SIE.DE", "SHELL", "OR.PA"],
  },
  asia: {
    label: "Asia & Pacific",
    flag: "🌏",
    symbols: ["9988.HK", "700.HK", "005930.KS", "7203.T", "9618.HK", "2330.TW", "9984.T", "1299.HK", "BABA", "PDD"],
  },
  uk: {
    label: "United Kingdom",
    flag: "🇬🇧",
    symbols: ["BP.L", "SHEL.L", "ULVR.L", "GSK.L", "RIO.L", "BATS.L", "NG.L", "LLOY.L", "BT-A.L", "BARC.L"],
  },
};

const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || "";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "us";
  const symbolsParam = searchParams.get("symbols");

  const group = WORLD_STOCK_GROUPS[region] || WORLD_STOCK_GROUPS["us"];
  const symbols = symbolsParam ? symbolsParam.split(",") : group.symbols;

  try {
    const results = await Promise.allSettled(
      symbols.map(async (sym) => {
        try {
          // Fix symbol suffixes for Alpha Vantage if needed. Usually .TRT or .LON etc.
          // Alpha Vantage supports .LON, .TRT, .FRK etc. 
          // Defaulting to pass symbol as is to Alpha Vantage.
          let avSymbol = sym;
          if (avSymbol.endsWith(".L")) avSymbol = avSymbol.replace(".L", ".LON");
          if (avSymbol.endsWith(".PA")) avSymbol = avSymbol.replace(".PA", ".PAR");
          if (avSymbol.endsWith(".DE")) avSymbol = avSymbol.replace(".DE", ".FRK");

          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSymbol}&apikey=${AV_KEY}`;
          const res = await fetch(url, { next: { revalidate: 60 } });
          const json = await res.json();
          const quote = json["Global Quote"];

          if (!quote || !quote["05. price"]) return null;

          const price = parseFloat(quote["05. price"]);
          const change = parseFloat(quote["09. change"]);
          const change_percent = parseFloat(quote["10. change percent"].replace("%", ""));
          const volume = parseInt(quote["06. volume"]);

          return {
            symbol: sym,
            name: sym, // AV global quote doesn't return full name, fallback to symbol
            price,
            currency: "USD", // AV doesn't provide currency in GLOBAL_QUOTE, assumption
            change,
            change_percent,
            market_cap: null,
            volume: volume || 0,
            high: parseFloat(quote["03. high"]) || null,
            low: parseFloat(quote["04. low"]) || null,
            fifty_two_week_high: null,
            fifty_two_week_low: null,
            pe_ratio: null,
            exchange: null,
            region,
          };
        } catch {
          return null;
        }
      })
    );

    const data = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data,
      region,
      regionLabel: group.label,
      flag: group.flag,
    });
  } catch (error: any) {
    console.error("World Stocks API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch world stocks", details: error.message },
      { status: 500 }
    );
  }
}
