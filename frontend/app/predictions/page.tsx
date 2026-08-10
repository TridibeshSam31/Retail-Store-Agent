"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getInventory } from "@/lib/api/client";
import { RiskBadge, StoreBadge } from "@/components/ui/badges";
import { TableSkeleton, EmptyState } from "@/components/ui/primitives";
import { formatQuantity } from "@/lib/formatting";
import Link from "next/link";

export default function PredictionsPage() {
  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ["inventory", "predictions"],
    queryFn: () => getInventory(),
  });

  // Filter items that have predictions and stock alerts
  const predictedItems = inventory?.filter(i => i.prediction != null) ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-700 text-zinc-950 uppercase tracking-tight">AI PREDICTIONS & RISK MODEL</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Forecast-driven reorder modeling integrating XGBoost demand predictions with standard Operations Research inventory formulas.</p>
        </div>

        {/* Prediction Formula Intro Panel */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950 flex items-center gap-2">
            <span className="size-2 rounded-full bg-indigo-500 animate-pulse-dot" />
            XGBoost Forecast + Operations Research ROP Formula
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-650">
            <div className="space-y-2 leading-relaxed">
              <p>
                Our system predicts the **daily sales demand** (<code className="font-mono bg-zinc-100 text-zinc-800 px-1 rounded">d_hat</code>) using machine learning, then evaluates the **Reorder Point (ROP)**:
              </p>
              <div className="font-mono text-zinc-900 bg-zinc-50 border border-zinc-150 rounded p-2.5 text-center">
                ROP = (d_hat × Lead Time) + Safety Stock
              </div>
              <p className="text-[11px] text-zinc-400">
                Safety Stock accounts for sales volatility (demand standard deviation) under a 95% service level confidence coefficient.
              </p>
            </div>
            <div className="space-y-2 leading-relaxed">
              <p>
                When restock triggers occur, order sizes are calculated using the **Economic Order Quantity (EOQ)** formula:
              </p>
              <div className="font-mono text-zinc-900 bg-zinc-50 border border-zinc-150 rounded p-2.5 text-center">
                EOQ = √ ( (2 × Annual Demand × Order Cost) / Holding Cost )
              </div>
              <p className="text-[11px] text-zinc-400">
                Balances warehouse storage costs against transport dispatch shipping fees to calculate optimal replenishment loads.
              </p>
            </div>
          </div>
        </div>

        {/* Alert Category Explanation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-red-200 bg-red-50/30 rounded-lg p-4 space-y-1">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-red-500" />
              <span className="text-xs font-700 text-red-700 uppercase">Immediately Low</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              **Critical Stock Condition:** The actual current stock is immediately below the reorder point. Immediate agent negotiation or supplier escalation is triggered.
            </p>
          </div>
          <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-4 space-y-1">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-500" />
              <span className="text-xs font-700 text-amber-700 uppercase">Might Be Low</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              **Prediction-Driven Warning:** Daily forecast predictions indicate high upcoming demand velocity. Stockout is predicted within the supplier lead time window.
            </p>
          </div>
        </div>

        {/* Table of predicted risk list */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h2 className="text-[11px] font-700 uppercase tracking-widest text-zinc-500">Predicted Replenishment Targets</h2>
          </div>
          {isLoading ? (
            <TableSkeleton cols={7} rows={4} />
          ) : error ? (
            <div className="p-8 text-center text-red-500">Failed to load prediction alerts.</div>
          ) : predictedItems.length === 0 ? (
            <EmptyState title="No Predictions Logs" description="There are currently no items configured with active demand model forecasts." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Store</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Current Stock</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Forecast Demand</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">ROP Threshold</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Optimal order (EOQ)</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Operational Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                   {predictedItems.map((inv) => (
                    <tr key={`${inv.store_id}-${inv.item_id}`} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-600 text-zinc-900">
                        <Link href={`/inventory/${inv.item_id}`} className="hover:underline">
                          {inv.item?.item_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <StoreBadge storeId={inv.store_id} storeName={inv.store?.location_name.split(" — ")[1]} size="sm" />
                      </td>
                      <td className="px-4 py-3.5 text-right font-700 text-zinc-700">
                        {formatQuantity(inv.qty_on_hand, inv.item?.unit ?? "units")}
                      </td>
                      <td className="px-4 py-3.5 text-right text-indigo-650 font-600">
                        {inv.prediction?.predicted_demand} {inv.item?.unit ?? "units"} / day
                      </td>
                      <td className="px-4 py-3.5 text-right font-500 text-zinc-600">
                        {inv.prediction?.rop} {inv.item?.unit ?? "units"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-500 text-zinc-600">
                        {inv.prediction?.eoq} {inv.item?.unit ?? "units"}
                      </td>
                      <td className="px-4 py-3.5">
                        <RiskBadge trigger={inv.prediction ? (inv.qty_on_hand <= inv.prediction.rop ? "immediately_low" : "might_be_low") : null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
