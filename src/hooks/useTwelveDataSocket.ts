import { useEffect, useState, useCallback, useRef } from "react";

interface TwelveDataTick {
  event: string;
  symbol: string;
  currency: string;
  exchange: string;
  type: string;
  timestamp: number;
  price: number;
  day_volume: number;
}

export function useTwelveDataSocket(symbol: string) {
  const [data, setData] = useState<TwelveDataTick | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  
  const apiKey = process.env.NEXT_PUBLIC_TWELVEDATA_API_KEY;

  useEffect(() => {
    if (!symbol || !apiKey) return;

    // We only connect for US stocks/commodities using this hook.
    const wsUrl = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${apiKey}`;
    
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Subscribe to the symbol
        ws.send(JSON.stringify({
          action: "subscribe",
          params: {
            symbols: symbol
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          // TwelveData broadcasts 'price' and 'subscribe-status' events
          if (parsed.event === "price" && parsed.symbol === symbol) {
            setData(parsed as TwelveDataTick);
          }
        } catch (e) {
          console.error("Error parsing Twelve Data websocket message:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after a delay, simulating typical socket resilience
        setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error("Twelve Data WebSocket error:", error);
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [symbol, apiKey]);

  return { isConnected, data };
}
