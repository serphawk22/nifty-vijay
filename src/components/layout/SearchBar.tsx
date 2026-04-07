"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export function SearchBar({ region = "in" }: { region?: "us" | "in" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);

  const STORAGE_KEY = "recent-stock-searches";

  // Load recent searches from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      // Only close if we're not showing recent searches
      if (query.length === 0 && recentSearches.length > 0 && isOpen) {
        // Keep open to show recents
      } else {
        setIsOpen(false);
      }
      return;
    }

    setIsLoading(true);
    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}&region=${region}`);
        const data = await res.json();
        setResults(data.results || []);
        setIsOpen(true);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, region, recentSearches.length, isOpen]);

  const handleSelect = (result: SearchResult) => {
    const route = region === "us" ? `/us-stocks/${result.symbol}` : `/stock/${result.symbol}`;
    
    // Save to history
    const newHistory = [
      result,
      ...recentSearches.filter(s => s.symbol !== result.symbol)
    ].slice(0, 5); // Keep last 5
    
    setRecentSearches(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));

    router.push(route);
    setQuery("");
    setIsOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentResults = query.length >= 2 ? results : recentSearches;
    if (!isOpen || currentResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % currentResults.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + currentResults.length) % currentResults.length);
        break;
      case "Enter":
        e.preventDefault();
        if (currentResults[selectedIndex]) {
          handleSelect(currentResults[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search stocks..."
          className="w-full px-10 py-2.5 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && (query.length >= 2 ? results.length > 0 : recentSearches.length > 0) && (
        <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-lg shadow-2xl overflow-hidden z-50">
          {query.length < 2 && (
            <div className="px-4 py-2 text-[10px] uppercase font-bold text-muted-foreground bg-muted/30 border-b border-border">
              Recent searches
            </div>
          )}
          {(query.length >= 2 ? results : recentSearches).map((result, index) => (
            <div
              key={result.symbol}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "px-4 py-3 cursor-pointer transition-colors flex items-start gap-3",
                selectedIndex === index ? "bg-accent" : "hover:bg-muted"
              )}
            >
              <div className="h-10 w-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{result.symbol}</div>
                <div className="text-sm text-muted-foreground truncate">{result.name}</div>
              </div>
              <div className="text-xs text-muted-foreground flex-shrink-0">{result.exchange}</div>
            </div>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-lg shadow-2xl p-4 text-center text-muted-foreground z-50">
          No stocks found for "{query}"
        </div>
      )}
    </div>
  );
}
