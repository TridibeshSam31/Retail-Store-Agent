/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getInventory, getNegotiations, getTransfers, getExpiryAlerts } from "@/lib/api/client";
import { RiskBadge, StoreBadge } from "@/components/ui/badges";
import { Button, CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useAppStore } from "@/lib/store";
import { formatQuantity, formatDate, getInventoryTrigger } from "@/lib/formatting";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { InventoryRiskChart, ExpiryTimelineChart } from "@/components/dashboard/DashboardCharts";

export default function DashboardPage() {
  const activeOrgId = useAppStore((state) => state.activeOrgId);
  const activeStoreId = useAppStore((state) => state.activeStoreId);

  const { data: inventory, isLoading: invLoading, error: invError, refetch: refetchInv } = useQuery({
    queryKey: ["inventory", activeOrgId, activeStoreId],
    queryFn: () => getInventory({ store_id: activeStoreId }),
  });

  const { data: negotiations, isLoading: negLoading, error: negError, refetch: refetchNeg } = useQuery({
    queryKey: ["negotiations", activeOrgId, activeStoreId],
    queryFn: () => getNegotiations({ store_id: activeStoreId }),
  });

  const { data: transfers, isLoading: xferLoading, error: xferError, refetch: refetchXfer } = useQuery({
    queryKey: ["transfers", activeOrgId, activeStoreId],
    queryFn: () => getTransfers(activeStoreId),
  });

  const { data: expiry, isLoading: expLoading, error: expError, refetch: refetchExp } = useQuery({
    queryKey: ["expiry", activeOrgId, activeStoreId],
    queryFn: () => getExpiryAlerts(activeStoreId),
  });

  const isAnyLoading = invLoading || negLoading || xferLoading || expLoading;
  const isAnyError = invError || negError || xferError || expError;

  const handleRetryAll = () => {
    refetchInv();
    refetchNeg();
    refetchXfer();
    refetchExp();
  };

  const criticalShortages = inventory?.filter(item => getInventoryTrigger(item) === "immediately_low") ?? [];
  const predictionWarnings = inventory?.filter(item => getInventoryTrigger(item) === "might_be_low") ?? [];
  const healthyItems = (inventory?.length ?? 0) - criticalShortages.length - predictionWarnings.length;
  const pendingApprovals = negotiations?.filter(neg => neg.status === "proposed") ?? [];
  const awaitingConfirms = transfers?.filter(xfer => !xfer.is_complete) ?? [];
  const urgentExpiries = expiry?.filter(exp => exp.days_until_expiry && exp.days_until_expiry <= 7) ?? [];

  if (isAnyError) {
    return (
      <AppShell>
        <ErrorState onRetry={handleRetryAll} message="Could not load dashboard data." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 w-full max-w-[1400px] mx-auto">

        {/* ─── KPI Summary Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isAnyLoading ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              <div className="premium-card p-5 space-y-2">
                <p className="text-[10px] font-mono font-700 text-zinc-400 uppercase tracking-widest">Critical Shortages</p>
                <p className="text-2xl font-900 text-zinc-900 font-mono">{criticalShortages.length}</p>
                <p className="text-[10px] font-mono text-zinc-400">
                  {criticalShortages.length > 0 ? "Replenishment triggered" : "All stocks secured"}
                </p>
              </div>
              <div className="premium-card p-5 space-y-2">
                <p className="text-[10px] font-mono font-700 text-zinc-400 uppercase tracking-widest">Forecast Risks</p>
                <p className="text-2xl font-900 text-zinc-900 font-mono">{predictionWarnings.length}</p>
                <p className="text-[10px] font-mono text-zinc-400">Items approaching ROP</p>
              </div>
              <div className="premium-card p-5 space-y-2">
                <p className="text-[10px] font-mono font-700 text-zinc-400 uppercase tracking-widest">Active Negotiations</p>
                <p className="text-2xl font-900 text-zinc-900 font-mono">{pendingApprovals.length}</p>
                <p className="text-[10px] font-mono text-zinc-400">Agent sessions in progress</p>
              </div>
              <div className="premium-card p-5 space-y-2">
                <p className="text-[10px] font-mono font-700 text-zinc-400 uppercase tracking-widest">In-Transit Shipments</p>
                <p className="text-2xl font-900 text-zinc-900 font-mono">{awaitingConfirms.length}</p>
                <p className="text-[10px] font-mono text-zinc-400">Awaiting confirmation</p>
              </div>
            </>
          )}
        </div>

        {/* ─── Visual Analytics Row (Charts) ─────────────────────────── */}
        {!isAnyLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="premium-card p-5 bg-white border border-zinc-200 rounded-lg shadow-sm">
              <InventoryRiskChart
                critical={criticalShortages.length}
                warning={predictionWarnings.length}
                healthy={Math.max(0, healthyItems)}
              />
            </div>
            <div className="premium-card p-5 bg-white border border-zinc-200 rounded-lg shadow-sm">
              <ExpiryTimelineChart expiries={expiry ?? []} />
            </div>
          </div>
        )}

        {/* ─── Critical Shortages & Forecast Alerts ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Critical Shortages */}
          <div className="premium-card flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2 font-mono">
                <span className="size-2 rounded-full bg-red-500" />
                Critical Shortages
              </h2>
              <Link href="/inventory" className="text-[10px] font-mono font-700 text-zinc-400 hover:text-zinc-900 uppercase">View All</Link>
            </div>
            <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto max-h-[280px]">
              {isAnyLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-5 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : criticalShortages.length === 0 ? (
                <EmptyState title="No Critical Shortages" description="All nodes within normal stock parameters." />
              ) : (
                criticalShortages.slice(0, 5).map((item) => (
                  <div key={`${item.store_id}-${item.item_id}`} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-xs font-800 text-zinc-900">{item.item?.item_name}</p>
                      <div className="flex items-center gap-2">
                        <StoreBadge storeId={item.store_id} storeName={item.store?.location_name.split(" — ")[1]} size="sm" />
                        <span className="text-[10px] font-mono text-zinc-400">ROP: {item.prediction?.rop}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-900 text-red-600 font-mono">{formatQuantity(item.qty_on_hand, item.item?.unit ?? "units")}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Forecast Alerts */}
          <div className="premium-card flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2 font-mono">
                <span className="size-2 rounded-full bg-amber-500" />
                Forecast Alerts
              </h2>
              <Link href="/predictions" className="text-[10px] font-mono font-700 text-zinc-400 hover:text-zinc-900 uppercase">View All</Link>
            </div>
            <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto max-h-[280px]">
              {isAnyLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-5 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : predictionWarnings.length === 0 ? (
                <EmptyState title="No Forecast Alerts" description="No impending replenishment limits." />
              ) : (
                predictionWarnings.slice(0, 5).map((item) => (
                  <div key={`${item.store_id}-${item.item_id}`} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-xs font-800 text-zinc-900">{item.item?.item_name}</p>
                      <StoreBadge storeId={item.store_id} storeName={item.store?.location_name.split(" — ")[1]} size="sm" />
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="text-sm font-800 text-zinc-900 font-mono">{formatQuantity(item.qty_on_hand, item.item?.unit ?? "units")}</p>
                      <span className="text-[9px] font-mono text-amber-600 font-700 uppercase">Reorder Risk</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ─── Pending Operations ───────────────────────────────────── */}
        <div className="premium-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2 font-mono">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Pending Operations
            </h2>
            <div className="flex gap-4 text-[10px] font-mono font-700 uppercase">
              <Link href="/negotiations" className="text-zinc-400 hover:text-zinc-900">Negotiations</Link>
              <Link href="/transfers" className="text-zinc-400 hover:text-zinc-900">Transfers</Link>
            </div>
          </div>
          <div className="divide-y divide-zinc-100">
            {isAnyLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-5 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))
            ) : pendingApprovals.length === 0 && awaitingConfirms.length === 0 ? (
              <EmptyState title="No Pending Operations" description="All agent dispatches and shipments verified." />
            ) : (
              <>
                {pendingApprovals.slice(0, 3).map((neg) => (
                  <div key={`neg-${neg.negotiation_id}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-800 text-zinc-900 uppercase">Negotiation #{neg.negotiation_id}</span>
                        <RiskBadge trigger={neg.trigger_type} />
                      </div>
                      <p className="text-xs text-zinc-500">
                        {neg.initiating_store?.location_name} — <span className="font-700 text-zinc-900">{neg.item?.item_name}</span>
                      </p>
                    </div>
                    <Link href={`/negotiations/${neg.negotiation_id}`}>
                      <Button size="sm" variant="primary" className="font-mono text-[9px] px-3.5">Open</Button>
                    </Link>
                  </div>
                ))}

                {awaitingConfirms.slice(0, 3).map((xfer) => {
                  const isFromStore = xfer.from_store_id === activeStoreId;
                  const isConfirmed = isFromStore ? xfer.from_confirmed : xfer.to_confirmed;

                  return (
                    <div key={`xfer-${xfer.transfer_id}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-800 text-zinc-900 uppercase">Transfer #{xfer.transfer_id}</span>
                          <span className={cn(
                            "text-[8px] font-mono font-800 px-1.5 py-0.5 rounded border uppercase",
                            isConfirmed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {isConfirmed ? "Confirmed" : "Action Required"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {formatQuantity(xfer.qty, xfer.item?.unit ?? "units")} of <span className="font-700 text-zinc-900">{xfer.item?.item_name}</span>
                        </p>
                      </div>
                      <Link href="/transfers">
                        <Button size="sm" variant={isConfirmed ? "secondary" : "primary"} className="font-mono text-[9px] px-3.5">
                          {isConfirmed ? "View" : "Confirm"}
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* ─── Expiry Alerts ────────────────────────────────────────── */}
        {urgentExpiries.length > 0 && (
          <div className="premium-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2 font-mono">
                <span className="size-2 rounded-full bg-zinc-500" />
                Upcoming Expiries
              </h2>
              <Link href="/expiry" className="text-[10px] font-mono font-700 text-zinc-400 hover:text-zinc-900 uppercase">View All</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
              {urgentExpiries.slice(0, 3).map((exp) => (
                <div key={exp.batch_id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-800 text-zinc-900">{exp.item?.item_name}</span>
                    <span className={cn(
                      "text-[8px] font-mono font-800 uppercase px-1.5 py-0.5 rounded border",
                      exp.days_until_expiry && exp.days_until_expiry <= 1 ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {exp.days_until_expiry}d left
                    </span>
                  </div>
                  <p className="text-sm font-900 font-mono text-zinc-900">{formatQuantity(exp.qty, exp.item?.unit ?? "units")}</p>
                  <p className="text-[10px] font-mono text-zinc-400">{exp.expiry_date ? formatDate(exp.expiry_date) : "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
