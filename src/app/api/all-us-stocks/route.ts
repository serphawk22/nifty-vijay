import { NextRequest, NextResponse } from "next/server";

// ─── In-Memory Cache (24-hour TTL) ───────────────────────────────────────────
// `force-dynamic` disables Next.js fetch cache, so we implement our own
// server-side cache to avoid hammering Alpha Vantage on every request.
let cachedData: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const AV_KEY = process.env.ALPHAVANTAGE_API_KEY || "";

export async function GET(request: NextRequest) {
  try {
    // Return cached data when still valid
    const now = Date.now();
    if (cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        count: cachedData.length,
        data: cachedData,
        cached: true,
      });
    }

    const url = `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=${AV_KEY}`;
    let res = await fetch(url, { cache: "no-store" });
    let csvContent = await res.text();

    // Alpha Vantage returns JSON instead of CSV when rate limits are hit
    if (!csvContent || csvContent.trim().startsWith("{")) {
      console.log("[All US Stocks] API Key rate limited! Falling back to 'demo' key...");
      
      const fallbackUrl = `https://www.alphavantage.co/query?function=LISTING_STATUS&apikey=demo`;
      res = await fetch(fallbackUrl, { cache: "no-store" });
      csvContent = await res.text();
      
      if (!csvContent || csvContent.trim().startsWith("{")) {
        // If even the demo key fails and we have stale cache, prefer it over returning an error
        if (cachedData) {
          return NextResponse.json({
            success: true,
            count: cachedData.length,
            data: cachedData,
            cached: true,
            stale: true,
          });
        }
        return NextResponse.json(
          { success: false, error: "Alpha Vantage API rate limit or error. Please try again later.", details: csvContent },
          { status: 429 }
        );
      }
    }

    // Parse CSV
    const rows = csvContent.split("\n").map(row => row.trim()).filter(Boolean);
    rows.shift(); // Remove header row

    const data = rows.map(row => {
      const values = row.split(",");
      return {
        symbol: values[0] || "",
        name: values[1] || "",
        exchange: values[2] || "",
        assetType: values[3] || "",
        ipoDate: values[4] || "",
        delistingDate: values[5] !== "null" ? values[5] : null,
        status: values[6] || "",
      };
    });

    const activeUsStocks = data.filter(item =>
      item.status?.toLowerCase() === "active" &&
      (item.assetType?.toLowerCase() === "stock" || item.assetType?.toLowerCase() === "etf")
    );

    // Store in cache
    cachedData = activeUsStocks;
    cacheTimestamp = now;

    return NextResponse.json({
      success: true,
      count: activeUsStocks.length,
      data: activeUsStocks,
    });

  } catch (error: any) {
    console.error("All US Stocks API Error:", error);
    // On network failure, return stale cache if available
    if (cachedData) {
      return NextResponse.json({ success: true, count: cachedData.length, data: cachedData, cached: true, stale: true });
    }
    return NextResponse.json(
      { success: false, error: "Failed to fetch all US stocks", details: error.message },
      { status: 500 }
    );
  }
}

