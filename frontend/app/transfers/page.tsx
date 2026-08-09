"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getTransfers, confirmTransfer } from "@/lib/api/client";
import { StoreBadge } from "@/components/ui/badges";
import { TableSkeleton, EmptyState, Button } from "@/components/ui/primitives";
import { formatQuantity, formatDateTime } from "@/lib/formatting";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function TransfersPage() {
  const queryClient = useQueryClient();

  const { data: transfers, isLoading, error, refetch } = useQuery({
    queryKey: ["transfers"],
    queryFn: () => getTransfers(),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ transferId, storeId }: { transferId: number; storeId: number }) =>
      confirmTransfer(transferId, storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Physical shipment confirmation recorded.");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message ?? "Failed to record confirmation.");
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-zinc-950 uppercase tracking-tight">SHIPMENT TRANSFERS</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Physical shipment dispatch tracking and destination landing verification between retail stores.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            Sync Transfers
          </Button>
        </div>

        {/* Invariant Alert Warning Box */}
        <div className="border border-zinc-200 bg-white rounded-lg p-4 shadow-sm flex items-start gap-3">
          <div className="size-8 rounded-lg bg-zinc-50 border border-zinc-150 flex items-center justify-center text-zinc-650 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-700 text-zinc-700 uppercase tracking-wide">Shipment Invariant State Rule</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              **Physical Completion Verification:** Stock levels are not modified when a manager approves a transfer. Changes are only committed to store database inventories after all affected stores log confirmations of physical stock dispatch and receipt.
            </p>
          </div>
        </div>

        {/* Transfers table */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <TableSkeleton cols={6} rows={4} />
          ) : error ? (
            <div className="p-8 text-center text-red-500">Failed to load transfer shipments.</div>
          ) : transfers?.length === 0 ? (
            <EmptyState
              title="No Active Transfers"
              description="No physical stock shipments are currently in transit or awaiting confirmations."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Item Shipment</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Route direction</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Quantity</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Store Status Checks</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Initiated</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {transfers?.map((xfer) => {
                    // Check if current manager user (Store 1) is involved and needs to confirm
                    const isSourceStore = xfer.source_store_id === 1;
                    const isDestStore = xfer.destination_store_id === 1;
                    const isStoreInvolved = isSourceStore || isDestStore;
                    const myStoreParty = xfer.parties.find((p) => p.store_id === 1);
                    const isAlreadyConfirmed = myStoreParty?.status === "confirmed";
                    const isActionRequired = isStoreInvolved && !isAlreadyConfirmed;

                    return (
                      <tr key={xfer.transfer_id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-600 text-zinc-550">
                          #{xfer.transfer_id}
                        </td>
                        <td className="px-4 py-3.5 font-700 text-zinc-900">
                          {xfer.item?.item_name}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <StoreBadge storeId={xfer.source_store_id} storeName={xfer.source_store?.location_name.split(" — ")[1]} size="sm" />
                            <span className="text-zinc-300">→</span>
                            <StoreBadge storeId={xfer.destination_store_id} storeName={xfer.destination_store?.location_name.split(" — ")[1]} size="sm" />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-700 text-zinc-800">
                          {formatQuantity(xfer.quantity, xfer.unit)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-2 flex-wrap">
                            {xfer.parties.map((p) => {
                              const isConfirmed = p.status === "confirmed";
                              return (
                                <span
                                  key={p.store_id}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-600 border uppercase flex items-center gap-1",
                                    isConfirmed
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-150"
                                      : "bg-amber-50 text-amber-700 border-amber-150 animate-pulse-dot"
                                  )}
                                >
                                  <span className={cn("size-1 rounded-full", isConfirmed ? "bg-emerald-500" : "bg-amber-500")} />
                                  S{p.store_id}: {isConfirmed ? "Sent/Rcvd" : "Pending"}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-450">{formatDateTime(xfer.created_at)}</td>
                        <td className="px-4 py-3.5 text-right">
                          {isActionRequired ? (
                            <Button
                              size="sm"
                              variant="primary"
                              loading={confirmMutation.isPending && confirmMutation.variables?.transferId === xfer.transfer_id}
                              onClick={() => confirmMutation.mutate({ transferId: xfer.transfer_id, storeId: 1 })}
                            >
                              Confirm Load
                            </Button>
                          ) : (
                            <span className="text-[10px] text-zinc-400 font-600 uppercase bg-zinc-100 px-1.5 py-0.5 border rounded">
                              {xfer.is_complete ? "Completed" : "Awaiting Others"}
                            </span>
                          )}
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
