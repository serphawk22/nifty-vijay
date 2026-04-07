"use client";

import { useState, useEffect } from "react";
import { Bell, X, BellPlus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceAlertModalProps {
  symbol: string;
  currentPrice: number;
}

export function PriceAlertModal({ symbol, currentPrice }: PriceAlertModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState<string>(currentPrice.toString());
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  // Fetch active alerts for this symbol
  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`/api/alerts/price?symbol=${symbol}`);
      const data = await res.json();
      if (data.success && data.alerts) {
        setActiveAlerts(data.alerts);
      }
    } catch (e) {
      console.error("Failed to fetch alerts");
    }
  };

  const handleSaveAlert = async () => {
    const target = parseFloat(targetPrice);
    if (isNaN(target) || target <= 0) return;

    setIsLoading(true);
    setSuccess(false);
    try {
      // Determine if we want an alert for above or below based on current price
      const direction = target > currentPrice ? "ABOVE" : "BELOW";

      const res = await fetch("/api/alerts/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          targetPrice: target,
          direction
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        fetchAlerts(); // refresh active alerts
        setTimeout(() => {
           setIsOpen(false);
           setSuccess(false);
        }, 1500);
      } else {
        alert(data.error || "Failed to set alert.");
      }
    } catch (e) {
      console.error(e);
      alert("Error setting alert.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/price?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAlerts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border border-blue-500/20 transition-all font-medium text-sm"
      >
        <BellPlus className="w-4 h-4" />
        <span className="hidden sm:inline">Set Target Alert</span>
        <span className="sm:hidden">Alert</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-popover border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-foreground">Price Alert for {symbol}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Current Price Reference */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Price:</span>
                <span className="font-mono font-medium text-foreground">
                  ₹{currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Target Price to Alert:</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₹</span>
                  <input
                    type="number"
                    step="0.05"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-3 text-lg font-mono placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send you an email when the price crosses this target.
                </p>
              </div>

              {/* Success State */}
              {success && (
                <div className="flex items-center gap-2 text-green-500 bg-green-500/10 p-3 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Alert successfully set!
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleSaveAlert}
                disabled={isLoading || !targetPrice}
                className={cn(
                  "w-full py-3 rounded-xl font-medium flex justify-center items-center gap-2 transition-all",
                  isLoading ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                )}
              >
                {isLoading ? <div className="w-4 h-4 border-2 border-current border-t-transparent animate-spin rounded-full" /> : "Save Alert"}
              </button>

              {/* Active Alerts List */}
              {activeAlerts.length > 0 && (
                <div className="pt-4 border-t border-border mt-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Active Alerts</h4>
                  <div className="space-y-2 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                    {activeAlerts.map(alert => (
                      <div key={alert.id} className="flex justify-between items-center bg-muted/40 border border-border/50 rounded-lg p-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={alert.direction === "ABOVE" ? "text-green-500" : "text-rose-500"}>
                            {alert.direction === "ABOVE" ? "↑" : "↓"}
                          </span>
                          <span className="font-mono text-foreground font-medium">₹{alert.targetPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteAlert(alert.id)}
                          className="text-xs text-muted-foreground hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
