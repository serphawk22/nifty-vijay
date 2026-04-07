"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Newspaper, Clock, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  source: string;
  id: string;
}

interface MarketNewsProps {
  region?: "in" | "us";
}

export function MarketNews({ region = "in" }: MarketNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(`/api/news?region=${region}`);
        if (!res.ok) throw new Error("Failed to fetch news");
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
          setNews(json.data.slice(0, 9)); // Get top 9 to form a nice grid
        } else {
          throw new Error("Invalid format from news API");
        }
      } catch (err) {
        console.error("News fetch error:", err);
        setError("Failed to load market news.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [region]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-blue-500" /> Latest {region === "us" ? "US" : "Market"} News
          </h3>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" /> {region === "us" ? "Curated updates on S&P 500, NASDAQ, and US Markets" : "Curated updates on Indian Markets, NSE, and BSE"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          <span className="text-sm font-medium text-blue-500/80">
            Live Feed
          </span>
        </div>
      </div>

      <div className="w-full">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse flex flex-col p-6 rounded-3xl border border-border/50 bg-card h-48">
                <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
                <div className="h-5 bg-muted rounded w-full mb-2"></div>
                <div className="h-5 bg-muted rounded w-5/6 mb-auto"></div>
                <div className="h-3 bg-muted rounded w-1/3 mt-4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-border">
            <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-20 text-red-400" />
            <p className="text-lg font-medium text-foreground">{error}</p>
            <p className="text-sm mt-1">Please try refreshing the page later.</p>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card rounded-3xl border border-border">
            <p className="text-lg">No recent news available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item, index) => {
              let parsedDate = "";
              try {
                if (item.pubDate) {
                  parsedDate = formatDistanceToNow(new Date(item.pubDate), { addSuffix: true });
                }
              } catch (e) {
                parsedDate = item.pubDate;
              }

              // Make the very first news item span more columns on larger screens for a "featured" look if desired
              const isFeatured = index === 0;

              return (
                <a
                  key={item.id}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "group flex flex-col p-6 md:p-8 rounded-3xl border border-border/50 bg-card hover:bg-muted/30 transition-all duration-300 relative overflow-hidden",
                    "hover:border-blue-500/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
                    isFeatured ? "md:col-span-2 lg:col-span-2 bg-gradient-to-br from-card to-blue-900/10" : ""
                  )}
                >
                  <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 duration-300">
                    <ExternalLink className="w-5 h-5 text-blue-400" />
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold tracking-wider uppercase border border-blue-500/20">
                      {item.source}
                    </span>
                  </div>

                  <h4 className={cn(
                    "font-bold text-foreground group-hover:text-blue-400 leading-snug transition-colors mb-auto",
                    isFeatured ? "text-xl md:text-2xl line-clamp-3" : "text-lg line-clamp-3"
                  )}>
                    {item.title}
                  </h4>

                  {isFeatured && item.contentSnippet && (
                    <p className="mt-4 text-muted-foreground line-clamp-2 text-sm md:text-base leading-relaxed">
                      {item.contentSnippet}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-6 text-xs md:text-sm text-muted-foreground font-medium pt-4 border-t border-border/50">
                    <Clock className="w-4 h-4" />
                    {parsedDate}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
