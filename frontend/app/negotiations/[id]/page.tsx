/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import {
  getNegotiation,
  approveTransfer,
  rejectTransfer,
  addNegotiationTurn,
  getSupplierDraft,
} from "@/lib/api/client";
import { StatusBadge, RiskBadge } from "@/components/ui/badges";
import { NegotiationSkeleton, ErrorState, Button, EmptyState } from "@/components/ui/primitives";
import {
  formatDateTime,
  negotiationStatusLabel,
  negotiationStatusVariant,
  resolutionLabel,
} from "@/lib/formatting";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function NegotiationDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(
    params instanceof Promise ? params : Promise.resolve(params)
  );
  const id = Number(resolvedParams.id);

  const queryClient = useQueryClient();
  const [rejectMode, setRejectMode] = useState(false);
  const [renegotiateArg, setRenegotiateArg] = useState("");
  const [storeId, setStoreId] = useState<number>(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedStoreId = localStorage.getItem("store_id");
      if (savedStoreId) {
        setStoreId(Number(savedStoreId));
      }
    }
  }, []);

  const { data: neg, isLoading, error, refetch } = useQuery({
    queryKey: ["negotiation", id],
    queryFn: () => getNegotiation(id),
  });

  const { data: supplierDraft } = useQuery({
    queryKey: ["supplierDraft", id],
    queryFn: () => getSupplierDraft(id),
    enabled: neg?.status === "rejected" || neg?.resolution_type === "supplier",
  });

  // Action mutations
  const approveMutation = useMutation({
    mutationFn: () => approveTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", id] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Transfer approved! Awaiting physical store confirmations.");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message ?? "Failed to approve transfer.");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", id] });
      toast.success("Proposal rejected.");
      setRejectMode(true);
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message ?? "Failed to reject proposal.");
    },
  });

  const renegotiateMutation = useMutation({
    mutationFn: () =>
      addNegotiationTurn(id, {
        store_id: storeId,
        turn_number: (neg?.turns?.length ?? 0) + 1,
        argument_text: renegotiateArg,
        responded: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negotiation", id] });
      toast.success("Renegotiation started.");
      setRejectMode(false);
      setRenegotiateArg("");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message ?? "Failed to restart negotiation.");
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <NegotiationSkeleton />
      </AppShell>
    );
  }

  if (error || !neg) {
    return (
      <AppShell>
        <ErrorState onRetry={refetch} message="Could not find negotiation record." />
      </AppShell>
    );
  }

  const isProposed = neg.status === "proposed";
  const isApproved = neg.status === "approved";

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Back navigation & Header */}
        <div className="flex items-center gap-3">
          <Link href="/negotiations" className="text-zinc-400 hover:text-zinc-950 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-700 uppercase tracking-widest text-zinc-400">Agent Negotiation ID #{neg.negotiation_id}</span>
              <RiskBadge trigger={neg.trigger_type} />
            </div>
            <h1 className="text-xl font-800 text-zinc-955 uppercase tracking-tight">
              Deficit Resolution: {neg.item?.item_name}
            </h1>
          </div>
          <div className="ml-auto">
            <StatusBadge variant={negotiationStatusVariant(neg.status)} dot={isProposed}>
              {negotiationStatusLabel(neg.status)}
            </StatusBadge>
          </div>
        </div>

        {/* Resolution details panel */}
        {neg.resolution_type && (
          <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-955">
              Resolution Decision: {resolutionLabel(neg.resolution_type)}
            </h2>

            {/* Supplier Escalation Panel */}
            {neg.resolution_type === "supplier" && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">External Supplier Restock Proposal</p>
                  <span className="text-[9px] font-600 text-zinc-500 bg-zinc-200 rounded px-1">No network surplus available</span>
                </div>
                {supplierDraft && supplierDraft.has_supplier ? (
                  <div className="space-y-3 pt-1">
                    <div className="bg-white border border-zinc-200 rounded p-3 text-xs font-mono text-zinc-700 whitespace-pre-wrap">
                      {supplierDraft.message}
                    </div>
                    {supplierDraft.link && (
                      <div className="flex justify-end">
                        <a href={supplierDraft.link} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="primary">
                            Open WhatsApp Link
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-450 italic py-2">
                    {supplierDraft?.instruction || "No supplier configured for this product category. Restock must be initiated manually."}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Negotiation Turn Transcript */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-150 flex items-center justify-between">
            <h2 className="text-[10px] font-800 uppercase tracking-wider text-zinc-900 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Autonomous Agent Transcript Timeline
            </h2>
            <span className="text-[9px] font-mono text-zinc-450 font-700 bg-zinc-50 border border-zinc-250 rounded px-2 py-0.5 uppercase">
              {neg.turns?.length || 0} turns recorded
            </span>
          </div>

          <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto">
            {neg.turns && neg.turns.length === 0 ? (
              <EmptyState title="Transcript Empty" description="Agent negotiation has started but no logs have been recorded yet." />
            ) : (
              neg.turns?.map((turn) => {
                const isArbitrator = turn.store_id === null;

                return (
                  <div key={turn.turn_id} className={cn("flex gap-3", isArbitrator ? "justify-center" : "items-start")}>
                    {/* Agent avatar icon */}
                    {!isArbitrator && (
                      <div className="size-8 rounded-full bg-zinc-900 text-white border border-zinc-200 text-[10px] font-800 flex items-center justify-center shrink-0">
                        {turn.store_id ? `S${turn.store_id}` : "?"}
                      </div>
                    )}

                    {/* Chat Bubble container */}
                    <div
                      className={cn(
                        "rounded-lg border p-4 space-y-2 max-w-xl shadow-sm text-xs",
                        isArbitrator
                          ? "bg-indigo-50/50 border-indigo-150 text-zinc-850 w-full"
                          : "bg-white border-zinc-200 text-zinc-800"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 border-b border-zinc-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          {isArbitrator ? (
                            <>
                              <span className="font-800 text-indigo-700 uppercase tracking-widest text-[9px]">Arbitrator</span>
                              <span className="text-[9px] text-indigo-500 font-600 bg-indigo-100/50 px-1 rounded uppercase">Neutral Moderator</span>
                            </>
                          ) : (
                            <>
                              <span className="font-700 text-zinc-900 uppercase">Store {turn.store_id} Agent</span>
                              <span className="text-[9px] text-zinc-400 font-500">Initiator</span>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-450">{formatDateTime(turn.created_at)}</span>
                      </div>
                      <p className="leading-relaxed font-400">{turn.argument_text}</p>
                      <div className="flex items-center justify-between text-[10px] text-zinc-450 font-mono pt-1">
                        <span>Turn #{turn.turn_number}</span>
                        <span className="uppercase font-600">{turn.responded ? "Responded" : "No response"}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Manager Action Decisions Panel */}
        {isProposed && (
          <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Pending Manager Action</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Review agent recommendations. You are logged in as Store {storeId} Manager — this transaction requires your approval to move to physical stock allocation status.
            </p>

            {!rejectMode ? (
              <div className="flex gap-3">
                <Button variant="primary" onClick={() => approveMutation.mutate()} loading={approveMutation.isPending}>
                  Approve Proposal
                </Button>
                <Button variant="secondary" onClick={() => rejectMutation.mutate()} loading={rejectMutation.isPending}>
                  Reject Proposal
                </Button>
              </div>
            ) : (
              <div className="border border-zinc-150 rounded-lg p-4 space-y-3 bg-zinc-50">
                <label className="block text-xs font-700 text-zinc-650 uppercase">Renegotiation Argument (Optional)</label>
                <textarea
                  placeholder="Specify renegotiation message or target quantities..."
                  value={renegotiateArg}
                  onChange={(e) => setRenegotiateArg(e.target.value)}
                  className="w-full h-20 px-3 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => renegotiateMutation.mutate()} loading={renegotiateMutation.isPending}>
                    Start Renegotiation
                  </Button>
                  {supplierDraft?.has_supplier ? (
                    <a href={supplierDraft.link} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" size="sm">
                        Contact Supplier
                      </Button>
                    </a>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => toast.info("Escalating to supplier offline.")}>
                      Contact Supplier
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setRejectMode(false)}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Manager Post-Approval State */}
        {isApproved && (
          <div className="bg-zinc-900 border border-zinc-800 text-zinc-50 rounded-lg p-5 shadow-sm space-y-2">
            <h3 className="text-sm font-700 text-white uppercase flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse-dot" />
              Manager Approved
            </h3>
            <p className="text-xs text-zinc-400">
              This transfer proposal was approved. The shipment is now waiting for physical dispatch and confirmation by the involved stores.
            </p>
            <div className="pt-2">
              <Link href="/transfers">
                <Button size="sm" variant="outline">
                  Confirm Shipment Load
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
