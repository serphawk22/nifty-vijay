"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, Plus, Trash2, TrendingUp, TrendingDown, Search, Mail, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Subscription {
  id: string;
  symbol: string;
  alertHighEnabled: boolean;
  alertLowEnabled: boolean;
  thresholdPct: number;
}

function getAuthHeader(): string {
  if (typeof window === "undefined") return "";
  const token = localStorage.getItem("token");
  return token ? `Bearer ${token}` : "";
}

function useUserEmail(): string {
  const [email, setEmail] = useState("");
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setEmail(user?.email || "");
    } catch {}
  }, []);
  return email;
}

export default function AlertsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [addSymbol, setAddSymbol] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const userEmail = useUserEmail();

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Debounced Search Effect
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    const debounce = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setSearchResults(json.results || []);
        setShowDropdown(true);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts/subscribe", {
        headers: { authorization: getAuthHeader() },
      });
      const json = await res.json();
      if (json.success) setSubs(json.data);
    } catch {
      showToast("Failed to load subscriptions", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const handleAdd = async (symbolToSubscribe: string = query) => {
    const sym = symbolToSubscribe.trim().toUpperCase();
    if (!sym) return;
    
    setAdding(true);
    setShowDropdown(false);
    
    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: getAuthHeader() },
        body: JSON.stringify({ symbol: sym }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`✅ Alert added for ${sym}`);
        setQuery(""); // Clear input on success
        fetchSubs();
      } else {
        showToast(json.error || "Failed to add alert", false);
      }
    } catch {
      showToast("Network error", false);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (symbol: string) => {
    try {
      await fetch(`/api/alerts/subscribe?symbol=${symbol}`, {
        method: "DELETE",
        headers: { authorization: getAuthHeader() },
      });
      setSubs(prev => prev.filter(s => s.symbol !== symbol));
      showToast(`Removed alert for ${symbol}`);
    } catch {
      showToast("Failed to remove", false);
    }
  };

  const handleToggle = async (sub: Subscription, field: "alertHighEnabled" | "alertLowEnabled") => {
    const updated = { ...sub, [field]: !sub[field] };
    setSubs(prev => prev.map(s => s.id === sub.id ? updated : s));
    try {
      await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: getAuthHeader() },
        body: JSON.stringify({
          symbol: sub.symbol,
          alertHighEnabled: updated.alertHighEnabled,
          alertLowEnabled: updated.alertLowEnabled,
          thresholdPct: sub.thresholdPct,
        }),
      });
    } catch {
      // Revert on failure
      setSubs(prev => prev.map(s => s.id === sub.id ? sub : s));
      showToast("Failed to update", false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-foreground font-sans transition-colors duration-300">
      
      {/* Background Gradient Orbs for Glassmorphism */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold border animate-in slide-in-from-top-4 fade-in duration-300",
          toast.ok
            ? "bg-white/90 dark:bg-emerald-950/90 backdrop-blur-md border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400"
            : "bg-white/90 dark:bg-rose-950/90 backdrop-blur-md border border-rose-100 dark:border-rose-800/50 text-rose-600 dark:text-rose-400"
        )}>
          {toast.ok ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {toast.msg}
        </div>
      )}

      {/* Main Content Wrapper */}
      <div className="relative z-10 container mx-auto px-4 py-12 max-w-5xl">
        
        {/* Header Section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[1px] shadow-xl shadow-blue-500/20">
              <div className="h-full w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-[15px] flex items-center justify-center">
                <Bell className="h-7 w-7 text-blue-600 dark:text-blue-400 shrink-0" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Stock Alerts</h1>
              <p className="text-base text-slate-500 dark:text-slate-400 mt-1.5 font-medium">Get email alerts when stocks hit 52-week highs or lows</p>
            </div>
          </div>
          
          {/* Notification Banner */}
          <div className="flex items-center gap-3 px-5 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
            <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              Alerts sent to <span className="font-bold text-blue-600 dark:text-blue-400">{userEmail || "your email"}</span>
            </p>
          </div>
        </div>

        {/* Glassmorphism Main Card */}
        <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden">
          
          {/* Add Alert Section */}
          <div className="p-6 md:p-8 border-b border-slate-200/50 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/40">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-5 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Add New Alert
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 relative">
              <div className="relative flex-1 z-50">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                  <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                  placeholder="Enter NSE symbol (e.g., RELIANCE, TCS, INFY)"
                  className="w-full pl-12 pr-12 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 placeholder:font-medium transition-all"
                />
                {isSearching && (
                   <div className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
                
                {/* Dropdown Results */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full mt-3 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 z-[100]">
                    {searchResults.map((result) => (
                      <div
                        key={result.symbol}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAdd(result.symbol);
                        }}
                        className="px-5 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{result.symbol}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] mt-0.5">{result.name}</div>
                        </div>
                        <button className="text-sm font-bold px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                 onClick={() => handleAdd(query)}
                 disabled={adding || !query.trim()}
                 className="px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base font-bold hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none shrink-0"
              >
                {adding ? "Adding..." : "Add Alert"}
              </button>
            </div>
          </div>

          {/* Subscriptions List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Loading your alerts...</p>
            </div>
          ) : subs.length === 0 ? (
            /* Empty State */
            <div className="py-24 text-center px-4">
              <div className="h-24 w-24 mx-auto rounded-full bg-blue-50 dark:bg-slate-800 flex items-center justify-center mb-6">
                <Bell className="h-10 w-10 text-blue-300 dark:text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">No alerts set up yet</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">Add a stock symbol above to start getting notified about major price breakouts.</p>
            </div>
          ) : (
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {subs.map(sub => (
                  <div key={sub.id} className="relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-500/30 transition-all duration-300">
                    
                    {/* Delete Action (Shows on Hover for desktop or always on mobile) */}
                    <button
                      onClick={() => handleDelete(sub.symbol)}
                      className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all z-10"
                      title="Remove alert"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                        <span className="font-bold text-base text-slate-700 dark:text-slate-300">{sub.symbol.charAt(0)}</span>
                      </div>
                      <div className="pr-8">
                        <div className="font-extrabold text-lg text-slate-900 dark:text-slate-100">{sub.symbol}</div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">NSE India</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* 52W High Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          52-Week High
                        </div>
                        <button
                          onClick={() => handleToggle(sub, "alertHighEnabled")}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                            sub.alertHighEnabled ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            sub.alertHighEnabled ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                      </div>

                      {/* 52W Low Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          <TrendingDown className="h-4 w-4 text-rose-500" />
                          52-Week Low
                        </div>
                        <button
                          onClick={() => handleToggle(sub, "alertLowEnabled")}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2",
                            sub.alertLowEnabled ? "bg-rose-500" : "bg-slate-200 dark:bg-slate-700"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            sub.alertLowEnabled ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                       <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Alert Trigger</span>
                       <span className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg">±{sub.thresholdPct}% Threshold</span>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
