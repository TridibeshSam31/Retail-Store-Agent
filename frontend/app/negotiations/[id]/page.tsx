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
  getTransfers,
} from "@/lib/api/client";
import { StatusBadge, RiskBadge, StoreBadge } from "@/components/ui/badges";
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

const MAX_RENEGOTIATION_ATTEMPTS = 3;

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

  // ── State classification ──────────────────────────────────────
  // status alone can't tell "agent still working" from "ready for
  // approval" — both are status="proposed". resolution_type is the
  // real signal that the agent has finished and produced an outcome.
  const { data: neg, isLoading, error, refetch } = useQuery({
    queryKey: ["negotiation", id],
    queryFn: () => getNegotiation(id),
    // Poll while the agent is still working so turns/resolution appear
    // without a manual refresh. Stop once there's a resolution or the
    // negotiation has reached a terminal status.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      const stillWorking = !data.resolution_type && data.status === "proposed";
      return stillWorking ? 2000 : false;
    },
  });

  const isNegotiating = !!neg && !neg.resolution_type && neg.status === "proposed";
  const isReadyForDecision = !!neg && neg.status === "proposed" && !!neg.resolution_type;
  const isApproved = neg?.status === "approved";
  const isRejected = neg?.status === "rejected";
  const isAborted = neg?.status === "aborted";
  const isCompleted = neg?.status === "completed";

  const { data: transfers } = useQuery({
    queryKey: ["transfers", "negotiation", id],
    queryFn: () => getTransfers(),
    enabled: !!neg && (neg.resolution_type === "transfer" || neg.resolution_type === "partial"),
    select: (all) => all.filter((t) => t.negotiation_id === id),
  });

  // Check if current user/session store is a participant in this negotiation
  const isParticipant = React.useMemo(() => {
    if (!neg) return false;
    const initId = neg.initiator_store_id ?? neg.initiating_store_id;
    if (initId === storeId) return true;
    if (neg.turns?.some((t) => t.store_id === storeId)) return true;
    if (transfers?.some((t) => t.from_store_id === storeId || t.to_store_id === storeId)) return true;
    return false;
  }, [neg, storeId, transfers]);

  // Count renegotiation attempts based on manager/store turns beyond initial round
  const renegotiationAttempts = React.useMemo(() => {
    if (!neg?.turns) return 0;
    // Count turns that are store replies beyond turn 1
    return neg.turns.filter((t) => t.turn_number > 2 && t.store_id !== null).length;
  }, [neg]);

  const canRenegotiate = renegotiationAttempts < MAX_RENEGOTIATION_ATTEMPTS;

  const { data: supplierDraft } = useQuery({
    queryKey: ["supplierDraft", id],
    queryFn: () => getSupplierDraft(id),
    enabled: neg?.resolution_type === "supplier",
  });

  // ── Mutations ────────────────────────────────────────────────
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
      toast.success("Proposal rejected. Choose what happens next below.");
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
            <StatusBadge variant={negotiationStatusVariant(neg.status)} dot={isNegotiating}>
              {isNegotiating ? "Agents Negotiating" : negotiationStatusLabel(neg.status)}
            </StatusBadge>
          </div>
        </div>

        {/* Status panel — always renders, single source of truth for "what's happening" */}
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-3">
          {isNegotiating && (
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse-dot shrink-0" />
              <div>
                <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Agents are negotiating</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Store agents are exchanging arguments below. No action is needed from you yet — this page will update automatically once a proposal is ready.
                </p>
              </div>
            </div>
          )}

          {isReadyForDecision && (
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-blue-500 shrink-0" />
              <div>
                <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">
                  Ready for approval — {resolutionLabel(neg.resolution_type!)}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  The agents finished negotiating. Review the outcome below.
                </p>
              </div>
            </div>
          )}

          {isApproved && (
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Approved — awaiting physical transfer</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  This transfer proposal was approved. It completes once both stores confirm the stock has physically moved.
                </p>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-red-500 shrink-0" />
              <div>
                <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Rejected</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  This proposal was rejected.
                </p>
              </div>
            </div>
          )}

          {isAborted && (
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-zinc-400 shrink-0" />
              <div>
                <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Cancelled</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  This negotiation was cancelled. If the shortage is still active, it will be re-flagged on the next prediction cycle.
                </p>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full bg-emerald-600 shrink-0" />
              <div>
                <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Completed</h2>
                <p className="text-xs text-zinc-500 mt-0.5">This negotiation has been fully resolved.</p>
              </div>
            </div>
          )}

          {/* Outcome details — shown whenever a resolution exists */}
          {neg.resolution_type === "supplier" && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3 mt-2">
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
                      <a
                        href={
                          supplierDraft.link.includes("text=")
                            ? supplierDraft.link
                            : `https://wa.me/919876543210?text=${encodeURIComponent(supplierDraft.message || "")}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="primary">
                          Send Message
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

          {(neg.resolution_type === "transfer" || neg.resolution_type === "partial") && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Proposed Transfers</p>
                {neg.resolution_type === "partial" && (
                  <span className="text-[9px] font-600 text-amber-700 bg-amber-100 rounded px-1 uppercase">Partial — surplus exhausted or even split</span>
                )}
              </div>
              {!transfers ? (
                <p className="text-xs text-zinc-400">Loading transfer details...</p>
              ) : transfers.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">No transfer records found for this negotiation yet.</p>
              ) : (
                <div className="space-y-2">
                  {transfers.map((t) => (
                    <div key={t.transfer_id} className="bg-white border border-zinc-200 rounded p-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <StoreBadge storeId={t.from_store_id} size="sm" />
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                        <StoreBadge storeId={t.to_store_id} size="sm" />
                        <span className="text-zinc-500 font-600">{t.qty} units</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.completed_at ? (
                          <span className="text-emerald-600 font-700 uppercase text-[10px]">Physically Confirmed</span>
                        ) : (
                          <span className="text-zinc-450 font-600 uppercase text-[10px]">
                            {t.confirmed_from && t.confirmed_to ? "Confirming..." : t.confirmed_from || t.confirmed_to ? "Awaiting one party" : "Awaiting both parties"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
            {!neg.turns || neg.turns.length === 0 ? (
              <EmptyState
                title={isNegotiating ? "Agents are just getting started" : "Transcript Empty"}
                description={
                  isNegotiating
                    ? "No turns recorded yet — this will fill in as the negotiation proceeds."
                    : "No logs were recorded for this negotiation."
                }
              />
            ) : (
              neg.turns.map((turn) => {
                const isArbitrator = turn.store_id === null;

                return (
                  <div key={turn.turn_id} className={cn("flex gap-3", isArbitrator ? "justify-center" : "items-start")}>
                    {!isArbitrator && (
                      <div className="size-8 rounded-full bg-zinc-900 text-white border border-zinc-200 text-[10px] font-800 flex items-center justify-center shrink-0">
                        {turn.store_id ? `S${turn.store_id}` : "?"}
                      </div>
                    )}

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

        {/* Manager Action Panel — strictly scoped to participant stores */}
        {isReadyForDecision && isParticipant && (
          <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Pending Manager Action</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              You are logged in as Store {storeId} Manager. Review the proposed outcome above — this requires your approval to move to physical stock allocation.
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
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-700 text-zinc-650 uppercase">Renegotiation Argument (Optional)</label>
                  <span className={cn(
                    "text-[10px] font-mono font-700 px-1.5 py-0.5 rounded border uppercase",
                    canRenegotiate ? "bg-zinc-100 text-zinc-600 border-zinc-200" : "bg-red-50 text-red-700 border-red-200"
                  )}>
                    Attempts: {renegotiationAttempts}/{MAX_RENEGOTIATION_ATTEMPTS}
                  </span>
                </div>
                {!canRenegotiate && (
                  <p className="text-xs text-red-600 font-500">
                    Maximum renegotiation limit reached ({MAX_RENEGOTIATION_ATTEMPTS} attempts). Please contact an external supplier or accept alternative terms.
                  </p>
                )}
                <textarea
                  placeholder={canRenegotiate ? "Specify renegotiation message or target quantities..." : "Renegotiation cap reached."}
                  value={renegotiateArg}
                  disabled={!canRenegotiate}
                  onChange={(e) => setRenegotiateArg(e.target.value)}
                  className="w-full h-20 px-3 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white disabled:bg-zinc-100 disabled:cursor-not-allowed"
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!canRenegotiate}
                    onClick={() => renegotiateMutation.mutate()}
                    loading={renegotiateMutation.isPending}
                  >
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

        {/* Observer Mode Indicator — shown when ready for decision but current store is unrelated */}
        {isReadyForDecision && !isParticipant && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-xs text-zinc-500 flex items-center justify-between">
            <span>Proposal decision pending authorization from participating store managers (Store #{neg.initiator_store_id ?? neg.initiating_store_id}).</span>
            <span className="text-[10px] font-mono text-zinc-400 uppercase font-700 bg-zinc-200/60 px-2 py-0.5 rounded">Observer Mode</span>
          </div>
        )}

        {/* Already-rejected: strictly scoped to participant stores */}
        {isRejected && isParticipant && (
          <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-700 uppercase tracking-wider text-zinc-950">Choose Next Step</h3>
            <div className="border border-zinc-150 rounded-lg p-4 space-y-3 bg-zinc-50">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-700 text-zinc-650 uppercase">Renegotiation Argument (Optional)</label>
                <span className={cn(
                  "text-[10px] font-mono font-700 px-1.5 py-0.5 rounded border uppercase",
                  canRenegotiate ? "bg-zinc-100 text-zinc-600 border-zinc-200" : "bg-red-50 text-red-700 border-red-200"
                )}>
                  Attempts: {renegotiationAttempts}/{MAX_RENEGOTIATION_ATTEMPTS}
                </span>
              </div>
              {!canRenegotiate && (
                <p className="text-xs text-red-600 font-500">
                  Maximum renegotiation limit reached ({MAX_RENEGOTIATION_ATTEMPTS} attempts). Escalate to supplier restock.
                </p>
              )}
              <textarea
                placeholder={canRenegotiate ? "Specify renegotiation message or target quantities..." : "Renegotiation cap reached."}
                value={renegotiateArg}
                disabled={!canRenegotiate}
                onChange={(e) => setRenegotiateArg(e.target.value)}
                className="w-full h-20 px-3 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white disabled:bg-zinc-100 disabled:cursor-not-allowed"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canRenegotiate}
                  onClick={() => renegotiateMutation.mutate()}
                  loading={renegotiateMutation.isPending}
                >
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
              </div>
            </div>
          </div>
        )}

        {/* Manager Post-Approval Action Card — strictly scoped to participant stores */}
        {isApproved && isParticipant && (
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