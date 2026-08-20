"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getExpiryAlerts } from "@/lib/api/client";
import { useAppStore } from "@/lib/store";
import { StoreBadge } from "@/components/ui/badges";
import { TableSkeleton, EmptyState, Button } from "@/components/ui/primitives";
import { formatQuantity, formatDate } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ExpiryPage() {
  const queryClient = useQueryClient();
  const activeOrgId = useAppStore((state) => state.activeOrgId);
  const activeStoreId = useAppStore((state) => state.activeStoreId);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: alerts, isLoading, error, refetch } = useQuery({
    queryKey: ["expiryAlerts", activeOrgId, activeStoreId],
    queryFn: () => getExpiryAlerts(),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-zinc-950 uppercase tracking-tight">BATCH EXPIRY ALERTS</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Independent tracking of food safety, consumable batch shelf lives, and stock retirement timelines.</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={isRefreshing}
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await queryClient.invalidateQueries({ queryKey: ["expiryAlerts"] });
                await refetch();
                toast.success("Batch expiry data synchronized.");
              } catch {
                toast.error("Could not sync batch data.");
              } finally {
                setIsRefreshing(false);
              }
            }}
          >
            Sync Batches
          </Button>
        </div>

        {/* Expiry Warning context card */}
        <div className="border border-zinc-200 bg-white rounded-lg p-4 shadow-sm flex items-start gap-3">
          <div className="size-8 rounded-lg bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-650 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-700 text-zinc-700 uppercase tracking-wide">Surplus Exclusion Rules</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Safety Buffer: Near-expiry stock is automatically excluded by sub-agents when calculating usable network transfer surpluses. This protects store partners from absorbing soon-to-expire inventories.
            </p>
          </div>
        </div>

        {/* Table list of expiries */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <TableSkeleton cols={6} rows={5} />
          ) : error ? (
            <div className="p-8 text-center text-red-500">Failed to load stock expiry records.</div>
          ) : alerts?.length === 0 ? (
            <EmptyState
              title="No Expiry Alerts"
              description="All current stock batches have comfortable expiration dates and safe shelf lives."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Batch ID</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Item Batch</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Storage location</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Available Qty</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Expiry date</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Shelf Life Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {alerts?.map((alert) => {
                    const days = alert.days_until_expiry ?? 7;
                    const isCritical = days <= 1;
                    const isWarning = days > 1 && days <= 3;

                    return (
                      <tr key={alert.batch_id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-600 text-zinc-450">
                          #{alert.batch_id}
                        </td>
                        <td className="px-4 py-3.5 font-700 text-zinc-900">
                          {alert.item?.item_name}
                        </td>
                        <td className="px-4 py-3.5">
                          <StoreBadge storeId={alert.store_id} storeName={alert.store?.location_name.split(" — ")[1]} size="sm" />
                        </td>
                        <td className="px-4 py-3.5 text-right font-700 text-zinc-700">
                          {formatQuantity(alert.qty, alert.item?.unit ?? "units")}
                        </td>
                        <td className="px-4 py-3.5 font-600 text-zinc-650">{alert.expiry_date ? formatDate(alert.expiry_date) : "-"}</td>
                        <td className="px-4 py-3.5">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-700 uppercase border tracking-wider",
                              isCritical
                                ? "bg-red-50 text-red-700 border-red-200 animate-pulse-dot"
                                : isWarning
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200"
                            )}
                          >
                            {days <= 0 ? "Expired" : days === 1 ? "Expires Tomorrow" : `Expires in ${days} days`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
