"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";

interface StockItem {
  symbol: string;
  name: string;
  exchange: string;
  assetType: string;
  ipoDate: string;
  status: string;
}

export default function AllUsStocksPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    async function fetchStocks() {
      try {
        const res = await fetch("/api/all-us-stocks");
        if (!res.ok) throw new Error("Failed to fetch stocks");
        const json = await res.json();
        if (json.success) {
          setStocks(json.data);
        } else {
          throw new Error(json.error || "Failed to parse data");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStocks();
  }, []);

  const filteredStocks = stocks.filter(stock => 
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
    stock.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
  const currentItems = filteredStocks.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleNext = () => setPage(p => Math.min(p + 1, totalPages));
  const handlePrev = () => setPage(p => Math.max(p - 1, 1));

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <DashboardNavbar region="us" />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="bg-blue-600 text-white p-2 rounded-lg">🇺🇸</span>
            All US Stocks
          </h1>
          <p className="text-gray-500 mt-2">
            Complete list of active equities listed on US exchanges.
            {!loading && ` (${stocks.length.toLocaleString()} Total symbols)`}
          </p>
        </div>
        
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search by symbol or name (e.g., AAPL)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-white/50 backdrop-blur-md border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <svg className="absolute right-3 top-3.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-lg text-gray-500 font-medium">Downloading US Markets DB...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 flex items-center gap-4">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-100">
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Company Name</th>
                  <th className="px-6 py-4">Exchange</th>
                  <th className="px-6 py-4 hidden md:table-cell">Asset Type</th>
                  <th className="px-6 py-4 hidden sm:table-cell">Status</th>
                  <th className="px-6 py-4 text-right">IPO Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                  {currentItems.map((stock, i) => (
                    <tr
                      key={stock.symbol}
                      className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4 font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        <Link href={`/us-stocks/${stock.symbol}`} className="block w-full">
                          {stock.symbol}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">
                        <Link href={`/us-stocks/${stock.symbol}`} className="block w-full">
                          {stock.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {stock.exchange}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-gray-500">
                        {stock.assetType}
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {stock.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 font-mono text-xs">
                        {stock.ipoDate || "N/A"}
                      </td>
                    </tr>
                  ))}
                {currentItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No stocks found matching "{searchTerm}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between sticky bottom-0">
            <p className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-900">{((page - 1) * itemsPerPage) + 1}</span> to <span className="font-semibold text-gray-900">{Math.min(page * itemsPerPage, filteredStocks.length)}</span> of <span className="font-semibold text-gray-900">{filteredStocks.length.toLocaleString()}</span> entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm transition-all"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={page === totalPages}
                className="px-4 py-2 border border-blue-600 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
