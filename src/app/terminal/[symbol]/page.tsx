import { ChartTerminal } from "@/components/terminal/ChartTerminal";
import { fetchInstruments } from "@/lib/instruments";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: {
    symbol: string;
  };
}

export default async function TerminalPage({ params }: PageProps) {
  const { symbol } = await params;

  // Clean symbol
  const cleanSymbol = decodeURIComponent(symbol).toUpperCase();

  const isIndian = !["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA"].includes(cleanSymbol) && 
                   !cleanSymbol.endsWith(".US"); // quick heuristic

  // Find Instrument Token if it's likely Indian
  let instrumentToken = 0;
  if (isIndian) {
    const instruments = await fetchInstruments();
    const instrument = instruments.find((i: any) => i.symbol === cleanSymbol);
    
    // For our US hybrid logic, we just pass 0 if Kite token isn't found.
    // TradingChart checks `isIndian` directly now, so it will correctly divert 0/missing tokens if it isn't an Indian stock.
    if (instrument) {
      instrumentToken = instrument.instrument_token;
    }
  }

  // Render the modular Chart Terminal which handles layout internally
  return (
    <ChartTerminal symbol={cleanSymbol} instrumentToken={instrumentToken} />
  );
}
