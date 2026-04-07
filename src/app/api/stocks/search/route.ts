import { NextResponse } from "next/server";
import { fetchInstruments } from "@/lib/instruments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.toUpperCase().trim() || "";
  const region = searchParams.get("region")?.toLowerCase() || "in";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (region === "us") {
      const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || "";
      const url = `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${AV_KEY}`;
      
      const res = await fetch(url, { next: { revalidate: 86400 } });
      const csvContent = await res.text();

      if (!csvContent || csvContent.includes("Error Message") || csvContent.includes("Information")) {
        return NextResponse.json({ results: [] });
      }

      const rows = csvContent.split("\n").map(r => r.trim()).filter(Boolean);
      rows.shift(); // remove headers

      const matches = [];
      for (const row of rows) {
        const vals = row.split(",");
        const symbol = vals[0] || "";
        const name = vals[1] || "";
        const exchange = vals[2] || "US";
        const status = vals[6] || "";

        if (status.toLowerCase() !== "active") continue;

        if (symbol === query || symbol.startsWith(query) || name.toUpperCase().includes(query)) {
          matches.push({ symbol, name, exchange });
          if (matches.length >= 10) break;
        }
      }
      return NextResponse.json({ results: matches });
    }

    // Default to Indian NSE Search
    const instruments = await fetchInstruments();

    const exactMatches = instruments.filter(
      (inst: any) => inst.symbol && inst.symbol === query
    );

    const partialMatches = instruments.filter(
      (inst: any) =>
        inst.symbol &&
        inst.name &&
        inst.symbol !== query &&
        (inst.symbol.startsWith(query) || inst.name.toUpperCase().includes(query))
    );

    const allMatches = [...exactMatches, ...partialMatches]
      .slice(0, 10)
      .map((inst: any) => ({
        symbol: inst.symbol,
        name: inst.name,
        exchange: "NSE",
      }));

    return NextResponse.json({ results: allMatches });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { results: [], error: "Search failed" },
      { status: 500 }
    );
  }
}

