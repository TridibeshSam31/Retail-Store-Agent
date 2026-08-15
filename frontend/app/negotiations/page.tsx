"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getNegotiations, getStores } from "@/lib/api/client";
import { StatusBadge, RiskBadge, StoreBadge } from "@/components/ui/badges";
import { TableSkeleton, EmptyState, Button } from "@/components/ui/primitives";
import { useAppStore } from "@/lib/store";
import { negotiationStatusLabel, negotiationStatusVariant, resolutionLabel, formatDateTime } from "@/lib/formatting";
import type { NegotiationStatus } from "@/types";
import Link from "next/link";

export default function NegotiationsPage() {
  const activeOrgId = useAppStore((state) => state.activeOrgId);
  const activeStoreId = useAppStore((state) => state.activeStoreId);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>(String(activeStoreId || "all"));

  useEffect(() => {
    setStoreFilter(String(activeStoreId));
  }, [activeStoreId]);

  const { data: stores } = useQuery({
    queryKey: ["stores", activeOrgId],
    queryFn: () => getStores(activeOrgId),
  });

  const { data: negotiations, isLoading, error, refetch } = useQuery({
    queryKey: ["negotiations", activeOrgId, activeStoreId, statusFilter, storeFilter],
    queryFn: () =>
      getNegotiations({
        status: statusFilter !== "all" ? (statusFilter as NegotiationStatus) : undefined,
        store_id: storeFilter !== "all" ? Number(storeFilter) : undefined,
      }),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-zinc-950 uppercase tracking-tight">AGENT NEGOTIATIONS</h1>
            <p className="text-xs text-zinc-500 mt-0.5 font-500">Autonomous communications between store agents to resolve stock deficits through peer-to-peer transfers.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => refetch()} variant="secondary">
              Refresh Feed
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <span className="text-xs font-700 text-zinc-400 uppercase tracking-wider md:mr-2">Timeline Filters:</span>

          <div className="flex flex-1 gap-4 w-full flex-wrap">
            {/* Status filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-600 text-zinc-400 uppercase">Workflow Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="proposed">Proposed / In Progress</option>
                <option value="approved">Approved by Agent</option>
                <option value="rejected">Rejected by Manager</option>
                <option value="aborted">Aborted / Failed</option>
                <option value="completed">Completed / Confirmed</option>
              </select>
            </div>

            {/* Store filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-600 text-zinc-400 uppercase">Involved Store:</label>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none"
              >
                <option value="all">All Stores</option>
                {stores
                  ?.filter((s) => !activeOrgId || s.org_id === activeOrgId)
                  .map((s) => (
                    <option key={s.store_id} value={s.store_id}>
                      {s.location_name.split(" — ")[1] ?? s.location_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Negotiations Table */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <TableSkeleton cols={7} rows={6} />
          ) : error ? (
            <div className="p-8 text-center text-red-500">Failed to load agent negotiations.</div>
          ) : negotiations?.length === 0 ? (
            <EmptyState
              title="No Negotiations Found"
              description="No active or past store negotiations match your filter choices."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">ID</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Deficit Item</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Initiator</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Trigger</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Resolution</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Initiated</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {negotiations?.map((neg) => {
                    const statusVal = negotiationStatusVariant(neg.status);
                    return (
                      <tr key={neg.negotiation_id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-600 text-zinc-500">
                          #{neg.negotiation_id}
                        </td>
                        <td className="px-4 py-3.5 font-700 text-zinc-900">
                          <Link href={`/negotiations/${neg.negotiation_id}`} className="hover:underline">
                            {neg.item?.item_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5">
                          <StoreBadge storeId={neg.initiating_store_id} storeName={neg.initiating_store?.location_name.split(" — ")[1]} size="sm" />
                        </td>
                        <td className="px-4 py-3.5">
                          <RiskBadge trigger={neg.trigger_type} />
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge variant={statusVal} dot={neg.status === "proposed"}>
                            {negotiationStatusLabel(neg.status)}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3.5">
                          {neg.resolution_type ? (
                            <span className="font-600 text-zinc-700 bg-zinc-50 border border-zinc-150 px-1.5 py-0.5 rounded text-[10px] uppercase">
                              {resolutionLabel(neg.resolution_type)}
                            </span>
                          ) : (
                            <span className="text-zinc-350 italic">unresolved</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-450">{formatDateTime(neg.created_at)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <Link href={`/negotiations/${neg.negotiation_id}`}>
                            <Button size="sm" variant={neg.status === "proposed" ? "primary" : "secondary"}>
                              {neg.status === "proposed" ? "Resolve" : "View Transcript"}
                            </Button>
                          </Link>
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
