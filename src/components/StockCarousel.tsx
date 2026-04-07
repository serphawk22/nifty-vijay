"use client";

import { useSocket } from "@/hooks/use-socket";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchStockQuotes, StockQuote } from "@/lib/stock-api";
import Link from "next/link";

// Initial stocks for India Market
const INITIAL_STOCKS: StockQuote[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", price: 2845.50, change: 45.30, changePercent: 1.62, trending: "up", lastUpdated: "" },
  { symbol: "TCS", name: "Tata Consultancy Services", price: 3920.75, change: 82.15, changePercent: 2.14, trending: "up", lastUpdated: "" },
  { symbol: "INFY", name: "Infosys Limited", price: 1678.90, change: 35.40, changePercent: 2.15, trending: "up", lastUpdated: "" },
  { symbol: "HDFCBANK", name: "HDFC Bank", price: 1542.30, change: -18.50, changePercent: -1.19, trending: "down", lastUpdated: "" },
  { symbol: "ADANIGREEN", name: "Adani Green Energy", price: 980.00, change: 15.00, changePercent: 1.55, trending: "up", lastUpdated: "" },
  { symbol: "WIPRO", name: "Wipro Limited", price: 445.20, change: 8.50, changePercent: 1.95, trending: "up", lastUpdated: "" },
  { symbol: "ITC", name: "ITC Limited", price: 412.80, change: -5.20, changePercent: -1.24, trending: "down", lastUpdated: "" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel", price: 1285.60, change: 22.40, changePercent: 1.77, trending: "up", lastUpdated: "" },
  { symbol: "SBIN", name: "State Bank of India", price: 625.90, change: -8.30, changePercent: -1.31, trending: "down", lastUpdated: "" },
  { symbol: "ICICIBANK", name: "ICICI Bank", price: 1098.75, change: 15.60, changePercent: 1.44, trending: "up", lastUpdated: "" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", price: 1756.40, change: 28.90, changePercent: 1.67, trending: "up", lastUpdated: "" },
  { symbol: "LT", name: "Larsen & Toubro", price: 3542.20, change: -42.10, changePercent: -1.17, trending: "down", lastUpdated: "" },
  { symbol: "AXISBANK", name: "Axis Bank", price: 1145.30, change: 18.75, changePercent: 1.66, trending: "up", lastUpdated: "" },
  { symbol: "MARUTI", name: "Maruti Suzuki", price: 12450.80, change: 185.60, changePercent: 1.51, trending: "up", lastUpdated: "" },
  { symbol: "SUNPHARMA", name: "Sun Pharma", price: 1678.50, change: -12.40, changePercent: -0.73, trending: "down", lastUpdated: "" },
];

// Initial stocks for US Market
const INITIAL_STOCKS_US: StockQuote[] = [
  { symbol: "AAPL", name: "Apple Inc.", price: 185.90, change: 1.25, changePercent: 0.68, trending: "up", lastUpdated: "" },
  { symbol: "MSFT", name: "Microsoft Corporation", price: 415.75, change: 3.15, changePercent: 0.76, trending: "up", lastUpdated: "" },
  { symbol: "GOOGL", name: "Alphabet Inc.", price: 152.40, change: -1.20, changePercent: -0.78, trending: "down", lastUpdated: "" },
  { symbol: "AMZN", name: "Amazon.com Inc.", price: 178.30, change: 2.45, changePercent: 1.39, trending: "up", lastUpdated: "" },
  { symbol: "TSLA", name: "Tesla, Inc.", price: 165.20, change: -4.50, changePercent: -2.65, trending: "down", lastUpdated: "" },
  { symbol: "NVDA", name: "NVIDIA Corporation", price: 895.60, change: 12.40, changePercent: 1.41, trending: "up", lastUpdated: "" },
  { symbol: "META", name: "Meta Platforms", price: 505.40, change: 8.30, changePercent: 1.67, trending: "up", lastUpdated: "" },
  { symbol: "BRK-B", name: "Berkshire Hathaway", price: 410.75, change: 1.60, changePercent: 0.39, trending: "up", lastUpdated: "" },
  { symbol: "V", name: "Visa Inc.", price: 282.40, change: -0.90, changePercent: -0.32, trending: "down", lastUpdated: "" },
  { symbol: "UNH", name: "UnitedHealth Group", price: 485.20, change: 5.40, changePercent: 1.13, trending: "up", lastUpdated: "" },
];

interface StockCarouselProps {
  region?: "in" | "us";
}

export function StockCarousel({ region = "in" }: StockCarouselProps) {
  const { stockData } = useSocket();
  const initialList = region === "us" ? INITIAL_STOCKS_US : INITIAL_STOCKS;
  const [stocks, setStocks] = useState<StockQuote[]>(initialList);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data from API
  useEffect(() => {
    const loadStocks = async () => {
      setLoading(true);
      setError(null);

      // Get all symbols from the regional list
      const symbols = initialList.map((s: StockQuote) => s.symbol);
      const response = await fetchStockQuotes(symbols);

      if (response.success && Array.isArray(response.data)) {
        const liveQuotes = response.data;

        const mappedStocks = initialList.map((initialStock: StockQuote) => {
          const liveQuote = liveQuotes.find(
            (q: any) => q.symbol.toUpperCase() === initialStock.symbol.toUpperCase()
          );

          if (liveQuote) {
            return {
              ...initialStock,
              price: liveQuote.last_price,
              change: liveQuote.change,
              changePercent: liveQuote.change_percent,
              trending: (liveQuote.change >= 0 ? "up" : "down") as "up" | "down"
            };
          }
          return initialStock;
        });

        setStocks(mappedStocks);
      }
      else if (!response.success && response.error) {
        setError(response.error);
      }

      setLoading(false);
    };

    loadStocks();

    const interval = setInterval(loadStocks, 10000);
    return () => clearInterval(interval);
  }, [region]);

  // Integrated WebSocket real-time data
  useEffect(() => {
    if (stockData) {
      const updates = Array.isArray(stockData) ? stockData : [stockData];

      setStocks(currentStocks => {
        const newStocks = [...currentStocks];
        updates.forEach((update: any) => {
          if (update.symbol) {
            const index = newStocks.findIndex(s => s.symbol.toUpperCase() === update.symbol.toUpperCase());
            if (index !== -1) {
              const oldPrice = newStocks[index].price;
              const newPrice = update.price;
              const change = update.change;
              const changePercent = update.percent || update.changePercent || ((change / (newPrice - change)) * 100).toFixed(2);

              newStocks[index] = {
                ...newStocks[index],
                price: newPrice,
                change: change,
                changePercent: parseFloat(changePercent as string),
                trending: newPrice >= oldPrice ? "up" : "down"
              };
            }
          }
        });
        return newStocks;
      });
    }
  }, [stockData]);

  const duplicatedStocks = [...stocks, ...stocks];

  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />

      {loading && stocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-muted-foreground text-sm">Loading stocks...</div>
        </div>
      )}

      <div className="flex gap-8 py-10 animate-scroll">
        {duplicatedStocks.map((stock, index) => {
          const isPositive = stock.trending === "up" || stock.change >= 0;
          const isFeatured = region === "in" 
            ? (stock.symbol === "RELIANCE" || stock.symbol === "TCS")
            : (stock.symbol === "AAPL" || stock.symbol === "NVDA");

          return (
            <Link
              href={region === "us" ? `/us-stocks/${encodeURIComponent(stock.symbol)}` : `/stock/${encodeURIComponent(stock.symbol)}`}
              key={`${stock.symbol}-${index}`}
              className={cn(
                "group relative flex h-72 w-80 flex-shrink-0 flex-col justify-between rounded-[2.5rem] border border-border bg-card p-8 backdrop-blur-2xl transition-all duration-500 hover:-translate-y-3 hover:border-border/50 hover:shadow-2xl",
                isFeatured && "border-blue-500/20 shadow-[0_0_80px_-20px_rgba(37,99,235,0.3)]"
              )}
            >
              <div className={cn(
                "absolute -inset-px rounded-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                isPositive
                  ? "bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent"
                  : "bg-gradient-to-br from-rose-500/10 via-transparent to-transparent"
              )} />

              <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-xl font-bold text-foreground shadow-inner group-hover:scale-110 transition-transform duration-500",
                    isFeatured && "from-blue-500/20 to-blue-500/5 shadow-blue-500/20"
                  )}>
                    {stock.symbol[0]}
                  </div>
                  <div>
                    <div className="text-xl font-bold tracking-tight text-foreground group-hover:text-blue-400 transition-colors duration-300">
                      {stock.symbol}
                    </div>
                    <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {stock.name.length > 20 ? stock.name.substring(0, 17) + "..." : stock.name}
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-500 group-hover:rotate-12",
                  isPositive ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                )}>
                  {isPositive ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                </div>
              </div>

              <div className="relative z-10 mt-6">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Current Price</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tighter text-foreground">
                    {region === "us" ? "$" : "₹"}{stock.price.toLocaleString(region === "us" ? 'en-US' : 'en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={cn(
                  "mt-2 inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full",
                  isPositive ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                )}>
                  <span>{isPositive ? "+" : "-"}{Math.abs(stock.change).toFixed(2)}</span>
                  <span className="opacity-60">({Math.abs(stock.changePercent).toFixed(2)}%)</span>
                </div>
              </div>

              <div className="absolute bottom-6 right-6 opacity-20 group-hover:opacity-100 transition-opacity duration-500">
                <div className={cn(
                  "h-1.5 w-8 rounded-full",
                  isPositive ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                )} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
