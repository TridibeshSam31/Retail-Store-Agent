/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getInventoryItem } from "@/lib/api/client";
import { RiskBadge, StoreBadge } from "@/components/ui/badges";
import { CardSkeleton, Button } from "@/components/ui/primitives";
import { formatQuantity, formatDateTime } from "@/lib/formatting";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function InventoryDetailPage({ params }: PageProps) {
  // Handle async params in Next.js App Router safely
  const resolvedParams = React.use(
    params instanceof Promise ? params : Promise.resolve(params)
  );
  const id = Number(resolvedParams.id);

  const [storeId, setStoreId] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedStoreId = localStorage.getItem("store_id");
      if (savedStoreId) {
        setStoreId(Number(savedStoreId));
      }
    }
  }, []);

  const { data: inv, isLoading, error } = useQuery({
    queryKey: ["inventoryItem", storeId, id],
    queryFn: () => getInventoryItem(storeId, id),
    enabled: !!storeId,
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back and title */}
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="text-zinc-400 hover:text-zinc-900 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div>
            <span className="text-[10px] font-700 uppercase tracking-widest text-zinc-400">Inventory analysis</span>
            <h1 className="text-xl font-800 text-zinc-950 uppercase tracking-tight">
              {isLoading ? "Loading Item..." : inv?.item?.item_name}
            </h1>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CardSkeleton className="md:col-span-2" />
            <CardSkeleton />
          </div>
        ) : error || !inv ? (
          <div className="p-8 text-center text-red-500 bg-white border border-zinc-200 rounded-lg">
            Item not found or failed to load stock analysis.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stock and Prediction Cards */}
            <div className="lg:col-span-2 space-y-6">
              {/* Core Stock stats */}
              <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Current Location</p>
                    <StoreBadge storeId={inv.store_id} storeName={inv.store?.location_name} />
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Risk Status</p>
                    <RiskBadge trigger={inv.prediction ? (inv.qty_on_hand <= inv.prediction.rop ? "immediately_low" : "might_be_low") : null} />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                  <div className="space-y-1">
                    <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Current Stock</p>
                    <p className="text-3xl font-900 text-zinc-950 font-mono">{formatQuantity(inv.qty_on_hand, inv.item?.unit ?? "units")}</p>
                  </div>
                  {inv.prediction && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Reorder Point (ROP)</p>
                        <p className="text-3xl font-800 text-zinc-800 font-mono">
                          {inv.prediction.rop} <span className="text-sm font-500 text-zinc-400 font-sans">{inv.item?.unit ?? "units"}</span>
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Economic Order Qty (EOQ)</p>
                        <p className="text-3xl font-800 text-zinc-800 font-mono">
                          {inv.prediction.eoq} <span className="text-sm font-500 text-zinc-400 font-sans">{inv.item?.unit ?? "units"}</span>
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-zinc-100 pt-4 text-xs text-zinc-400 flex items-center justify-between">
                  <span>Last database inventory synchronization:</span>
                  <span className="font-600 text-zinc-650 font-mono">{formatDateTime(new Date().toISOString())}</span>
                </div>
              </div>

              {/* Demand Prediction Model Card */}
              {inv.prediction && (
                <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                    <span className="size-2 rounded-full bg-indigo-500 animate-pulse-dot" />
                    <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">AI Demand Forecast Model</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Predicted Daily Demand (d_hat)</p>
                        <p className="text-xl font-800 text-zinc-900 mt-1 font-mono">
                          {inv.prediction.predicted_demand} {inv.item?.unit ?? "units"} / day
                        </p>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Calculated by XGBoost model using historical transactions, sales velocity trends, seasonality, and rolling volatility metrics.
                      </p>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-2.5">
                      <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Inventory Logistics Context</p>
                      <div className="space-y-1.5 text-xs text-zinc-600">
                        <div className="flex justify-between">
                          <span>Target Lead Time:</span>
                          <span className="font-600 text-zinc-800">3 Days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Holding Cost (Annual):</span>
                          <span className="font-600 text-zinc-800">Standard Tier</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Service Target (Service level):</span>
                          <span className="font-600 text-zinc-800">95% (Z-score 1.65)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar with item metadata, suppliers */}
            <div className="space-y-6">
              {/* Product Info */}
              <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Product Specification</h3>
                <div className="divide-y divide-zinc-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-zinc-400 font-500">Item ID</span>
                    <span className="font-mono text-zinc-900">#00{inv.item?.item_id}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-zinc-400 font-500">Category</span>
                    <span className="font-600 text-zinc-900">{inv.item?.category}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-zinc-400 font-500">Inventory Unit</span>
                    <span className="font-600 text-zinc-900">{inv.item?.unit}</span>
                  </div>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Operations Action</h3>
                {inv.prediction && inv.qty_on_hand <= inv.prediction.rop ? (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">
                      This item is currently flagged for stock alerts. Store agents may be actively negotiating transfers in the background.
                    </p>
                    <Link href="/negotiations" className="block w-full">
                      <Button variant="primary" className="w-full text-center py-2 text-xs">
                        Check Active Negotiations
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">No low stock triggers or negotiations active for this item.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
