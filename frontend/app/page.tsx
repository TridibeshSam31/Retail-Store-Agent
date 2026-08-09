"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getInventory, getNegotiations, getTransfers, getExpiryAlerts } from "@/lib/api/client";
import { RiskBadge, StoreBadge } from "@/components/ui/badges";
import { Button, CardSkeleton, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { formatQuantity, formatDate } from "@/lib/formatting";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const { data: inventory, isLoading: invLoading, error: invError, refetch: refetchInv } = useQuery({
    queryKey: ["inventory", "all"],
    queryFn: () => getInventory({ page_size: 100 }),
  });

  const { data: negotiations, isLoading: negLoading, error: negError, refetch: refetchNeg } = useQuery({
    queryKey: ["negotiations"],
    queryFn: () => getNegotiations(),
  });

  const { data: transfers, isLoading: xferLoading, error: xferError, refetch: refetchXfer } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => getTransfers(),
  });

  const { data: expiry, isLoading: expLoading, error: expError, refetch: refetchExp } = useQuery({
    queryKey: ["expiry"],
    queryFn: () => getExpiryAlerts(),
  });

  const isAnyLoading = invLoading || negLoading || xferLoading || expLoading;
  const isAnyError = invError || negError || xferError || expError;

  const handleRetryAll = () => {
    refetchInv();
    refetchNeg();
    refetchXfer();
    refetchExp();
  };

  const criticalShortages = inventory?.filter(item => item.trigger === "immediately_low") ?? [];
  const predictionWarnings = inventory?.filter(item => item.trigger === "might_be_low") ?? [];
  const pendingApprovals = negotiations?.filter(neg => neg.status === "proposed" || neg.status === "approved") ?? [];
  const awaitingConfirms = transfers?.filter(xfer => !xfer.is_complete) ?? [];
  const urgentExpiries = expiry?.filter(exp => exp.days_until_expiry <= 3) ?? [];

  if (isAnyError) {
    return (
      <AppShell>
        <ErrorState onRetry={handleRetryAll} message="Could not load dashboard data from the retail operations service." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Header Block */}
        <div className="border-b border-zinc-200 pb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono font-700 text-zinc-400 uppercase tracking-widest">Autonomous Agent Console</p>
              <h1 className="text-2xl font-900 tracking-tight text-zinc-950 uppercase mt-1">Operational Overview</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono font-700 text-zinc-500 bg-white border border-zinc-200 uppercase px-2.5 py-1 rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                Active Node: Store-1-Koramangala
              </span>
            </div>
          </div>
        </div>

        {/* Modular Grid KPI Indicators */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isAnyLoading ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            <>
              {/* Shortages Grid Cell */}
              <div className="premium-card p-5 flex flex-col justify-between h-[120px] bg-white">
                <span className="text-[9px] font-mono font-800 text-zinc-400 uppercase tracking-widest">Critical Shortages</span>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-900 text-zinc-950 font-mono">{criticalShortages.length}</span>
                  <span className="text-[10px] text-zinc-400 font-700 uppercase">nodes low</span>
                </div>
                <div className="mt-3 flex items-center text-[10px] font-mono">
                  {criticalShortages.length > 0 ? (
                    <span className="text-red-600 font-700 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-red-500 animate-pulse-dot" />
                      REPLENISHMENT TRIGGERED
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-700">STOCKS SECURED</span>
                  )}
                </div>
              </div>

              {/* Predictions Grid Cell */}
              <div className="premium-card p-5 flex flex-col justify-between h-[120px] bg-white">
                <span className="text-[9px] font-mono font-800 text-zinc-400 uppercase tracking-widest">Forecast Risks</span>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-900 text-zinc-950 font-mono">{predictionWarnings.length}</span>
                  <span className="text-[10px] text-zinc-400 font-700 uppercase">triggers</span>
                </div>
                <div className="mt-3 flex items-center text-[10px] font-mono">
                  {predictionWarnings.length > 0 ? (
                    <span className="text-amber-600 font-700">LEAD-TIME RISK DETECTED</span>
                  ) : (
                    <span className="text-zinc-400 font-700">NO RISK REPORTED</span>
                  )}
                </div>
              </div>

              {/* Communication Grid Cell */}
              <div className="premium-card p-5 flex flex-col justify-between h-[120px] bg-white">
                <span className="text-[9px] font-mono font-800 text-zinc-400 uppercase tracking-widest">Active Negotiations</span>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-900 text-zinc-950 font-mono">{pendingApprovals.length}</span>
                  <span className="text-[10px] text-zinc-400 font-700 uppercase">agent runs</span>
                </div>
                <div className="mt-3 flex items-center text-[10px] font-mono">
                  {pendingApprovals.length > 0 ? (
                    <span className="text-indigo-650 font-700 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse-dot" />
                      NEGOTIATIONS COMMITTED
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-700">TIMELINE STANDBY</span>
                  )}
                </div>
              </div>

              {/* Transit Grid Cell */}
              <div className="premium-card p-5 flex flex-col justify-between h-[120px] bg-white">
                <span className="text-[9px] font-mono font-800 text-zinc-400 uppercase tracking-widest">In Transit Shipment</span>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-900 text-zinc-950 font-mono">{awaitingConfirms.length}</span>
                  <span className="text-[10px] text-zinc-400 font-700 uppercase">loads</span>
                </div>
                <div className="mt-3 flex items-center text-[10px] font-mono">
                  {awaitingConfirms.length > 0 ? (
                    <span className="text-amber-600 font-700">AWAITING LANDING CHECKS</span>
                  ) : (
                    <span className="text-zinc-400 font-700">NO SHIPPINGS IN TRANSIT</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dual Alert Panels Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Critical Shortages Panel */}
          <div className="premium-card bg-white flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-150 flex items-center justify-between">
              <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                <span className="size-2 rounded-full bg-red-500" />
                Critical Stockout Shortages
              </h2>
              <Link href="/inventory" className="text-[10px] font-mono font-700 text-zinc-400 hover:text-zinc-900 uppercase">Browse All</Link>
            </div>
            <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto max-h-[320px]">
              {isAnyLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-5 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : criticalShortages.length === 0 ? (
                <EmptyState title="No Critical Shortages" description="All nodes are operating within normal stock parameters." className="border-0 shadow-none hover:shadow-none py-10" />
              ) : (
                criticalShortages.map((item) => (
                  <div key={item.id} className="p-5 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-xs font-800 text-zinc-950 uppercase tracking-tight">{item.item?.item_name}</p>
                      <div className="flex items-center gap-2">
                        <StoreBadge storeId={item.store_id} storeName={item.store?.location_name.split(" — ")[1]} size="sm" />
                        <span className="text-[10px] font-mono text-zinc-400 font-500">ROP: {item.prediction?.rop} {item.unit}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-950 text-red-600 font-mono">{formatQuantity(item.current_quantity, item.unit)}</p>
                      <p className="text-[9px] font-mono text-zinc-400 uppercase font-500">Stock Remaining</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Forecast-driven Alerts Panel */}
          <div className="premium-card bg-white flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-150 flex items-center justify-between">
              <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse-dot" />
                Forecast replenishment limits
              </h2>
              <Link href="/predictions" className="text-[10px] font-mono font-700 text-zinc-400 hover:text-zinc-900 uppercase">Browse All</Link>
            </div>
            <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto max-h-[320px]">
              {isAnyLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-5 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                ))
              ) : predictionWarnings.length === 0 ? (
                <EmptyState title="No Forecast Alerts" description="No impending replenishment stockout limits detected." className="border-0 shadow-none hover:shadow-none py-10" />
              ) : (
                predictionWarnings.map((item) => (
                  <div key={item.id} className="p-5 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                    <div className="space-y-1">
                      <p className="text-xs font-800 text-zinc-950 uppercase tracking-tight">{item.item?.item_name}</p>
                      <div className="flex items-center gap-2">
                        <StoreBadge storeId={item.store_id} storeName={item.store?.location_name.split(" — ")[1]} size="sm" />
                        <span className="text-[10px] font-mono text-zinc-400 font-500">Daily Demand: {item.prediction?.predicted_demand} {item.unit}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-800 text-zinc-950 font-mono">{formatQuantity(item.current_quantity, item.unit)}</p>
                      <span className="inline-block text-[8px] font-mono font-800 px-1 py-0.25 rounded-sm bg-amber-50 text-amber-700 border border-amber-250 uppercase tracking-wider">
                        Reorder Risk
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Pending Operations Panel */}
        <div className="premium-card bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-150 flex items-center justify-between">
            <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Runtime Action queue
            </h2>
            <div className="flex gap-4 text-[10px] font-mono font-700 uppercase">
              <Link href="/negotiations" className="text-zinc-400 hover:text-zinc-950">Agent runs</Link>
              <Link href="/transfers" className="text-zinc-400 hover:text-zinc-950">Shipments</Link>
            </div>
          </div>
          <div className="divide-y divide-zinc-100">
            {isAnyLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-5 space-y-2">
                  <Skeleton className="h-4.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))
            ) : pendingApprovals.length === 0 && awaitingConfirms.length === 0 ? (
              <EmptyState title="Runtime Action Queue Standby" description="All agent dispatches and stock shipments verified successfully." className="border-0 shadow-none hover:shadow-none" />
            ) : (
              <>
                {/* Active Negotiations */}
                {pendingApprovals.map((neg) => (
                  <div key={`neg-${neg.negotiation_id}`} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono font-800 text-zinc-900 uppercase">Agent Session #{neg.negotiation_id}</span>
                        <RiskBadge trigger={neg.trigger} />
                      </div>
                      <p className="text-xs text-zinc-650">
                        {neg.initiating_store?.location_name} requests surplus buffer for{" "}
                        <span className="font-700 text-zinc-900">{neg.item?.item_name}</span>.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {neg.resolution?.resolution_type === "transfer" && (
                        <div className="text-right hidden md:block space-y-0.5">
                          <p className="text-[9px] font-mono text-zinc-400 uppercase font-500">Allocation Target</p>
                          <p className="text-xs font-700 text-zinc-900">
                            {neg.resolution.quantity} {neg.resolution.unit} from {neg.resolution.source_store?.location_name.split(" — ")[1]}
                          </p>
                        </div>
                      )}
                      <Link href={`/negotiations/${neg.negotiation_id}`}>
                        <Button size="sm" variant="primary" className="font-mono text-[9px] px-3.5">
                          Open Logs
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}

                {/* Shipment Confirmations */}
                {awaitingConfirms.map((xfer) => {
                  const myStoreParty = xfer.parties.find(p => p.store_id === 1);
                  const isConfirmed = myStoreParty?.status === "confirmed";

                  return (
                    <div key={`xfer-${xfer.transfer_id}`} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 transition-colors">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] font-mono font-800 text-zinc-900 uppercase">Shipment #{xfer.transfer_id}</span>
                          <span className={cn(
                            "text-[8px] font-mono font-800 px-1.5 py-0.25 rounded-sm border uppercase tracking-wider",
                            isConfirmed ? "bg-emerald-50 text-emerald-700 border-emerald-150" : "bg-amber-50 text-amber-700 border-amber-150 animate-pulse-dot"
                          )}>
                            {isConfirmed ? "Stock Confirmed" : "Action Required"}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-650">
                          Transferring <span className="font-700 text-zinc-900">{formatQuantity(xfer.quantity, xfer.unit)}</span> of{" "}
                          <span className="font-700 text-zinc-900">{xfer.item?.item_name}</span> from{" "}
                          {xfer.source_store?.location_name} to {xfer.destination_store?.location_name}.
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block space-y-0.5">
                          <p className="text-[9px] font-mono text-zinc-400 uppercase font-500">Validation Checks</p>
                          <p className="text-xs font-700 text-zinc-900">
                            {xfer.parties.filter(p => p.status === "confirmed").length}/{xfer.parties.length} verified
                          </p>
                        </div>
                        <Link href="/transfers">
                          <Button size="sm" variant={isConfirmed ? "secondary" : "primary"} className="font-mono text-[9px] px-3.5">
                            {isConfirmed ? "View Checks" : "Confirm landing"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Near Expiry Batches */}
        <div className="premium-card bg-white p-5 space-y-4">
          <h2 className="text-[10px] font-800 uppercase tracking-widest text-zinc-900 flex items-center gap-2">
            <span className="size-2 rounded-full bg-zinc-500" />
            Batch Shelf-life Expirations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isAnyLoading ? (
              Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
            ) : urgentExpiries.length === 0 ? (
              <div className="col-span-3 text-center py-6 text-xs text-zinc-400 italic">
                No active batches approaching shelf-life expiration targets.
              </div>
            ) : (
              urgentExpiries.map((exp) => (
                <div key={exp.batch_id} className="border border-zinc-150 rounded p-4.5 space-y-3 bg-zinc-50 hover:bg-zinc-100/40 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-850 text-zinc-950 uppercase tracking-tight">{exp.item?.item_name}</span>
                    <span className={cn(
                      "text-[8px] font-mono font-800 uppercase px-1.5 py-0.25 rounded-sm border tracking-wider",
                      exp.days_until_expiry <= 1 ? "bg-red-50 text-red-700 border-red-150" : "bg-amber-50 text-amber-700 border-amber-150"
                    )}>
                      {exp.days_until_expiry === 1 ? "Expires Tomorrow" : `${exp.days_until_expiry} Days Left`}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-base font-950 text-zinc-900 font-mono">{formatQuantity(exp.quantity, exp.unit)}</span>
                    <StoreBadge storeId={exp.store_id} storeName={exp.store?.location_name.split(" — ")[1]} size="sm" />
                  </div>
                  <p className="text-[10px] font-mono text-zinc-400">Date: {formatDate(exp.expiry_date)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
