"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getInventory, getStores } from "@/lib/api/client";
import { RiskBadge, StoreBadge } from "@/components/ui/badges";
import { TableSkeleton, EmptyState, Button } from "@/components/ui/primitives";
import { formatQuantity, formatDateTime } from "@/lib/formatting";
import Link from "next/link";
import type { InventoryTrigger } from "@/types";

export default function InventoryPage() {
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: () => getStores(),
  });

  const { data: inventory, isLoading, error, refetch } = useQuery({
    queryKey: ["inventory", storeFilter, triggerFilter, search],
    queryFn: () =>
      getInventory({
        store_id: storeFilter !== "all" ? Number(storeFilter) : undefined,
        trigger: triggerFilter !== "all" ? (triggerFilter as InventoryTrigger) : undefined,
        search: search ? search : undefined,
      }),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-zinc-955 uppercase tracking-tight">STORE INVENTORY</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time tracking of current warehouse and storefront stock quantities across the organization.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          {/* Search bar */}
          <div className="w-full md:flex-1 relative">
            <input
              type="text"
              placeholder="Search by item name, category, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-800"
            />
          </div>

          <div className="flex w-full md:w-auto gap-3 flex-wrap">
            {/* Store select */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-600 text-zinc-400 uppercase">Store:</label>
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none"
              >
                <option value="all">All Stores</option>
                {stores?.map((s) => (
                  <option key={s.store_id} value={s.store_id}>
                    {s.location_name.split(" — ")[1] ?? s.location_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status select */}
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] font-600 text-zinc-400 uppercase">Risk Status:</label>
              <select
                value={triggerFilter}
                onChange={(e) => setTriggerFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700 focus:outline-none"
              >
                <option value="all">All States</option>
                <option value="immediately_low">Critically Low</option>
                <option value="might_be_low">Might Be Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory List Table */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          {isLoading ? (
            <TableSkeleton cols={6} rows={6} />
          ) : error ? (
            <div className="p-12 text-center text-red-500">
              Error fetching inventory. Please try again.
            </div>
          ) : inventory?.length === 0 ? (
            <EmptyState
              title="No Inventory Found"
              description="No matching items were found with your search filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Item</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Store Location</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Current Stock</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Risk Level</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider">Last Sync</th>
                    <th className="px-4 py-3 text-[10px] font-700 text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {inventory?.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <Link href={`/inventory/${inv.id}`} className="font-600 text-zinc-950 hover:underline">
                          {inv.item?.item_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-500">{inv.item?.category}</td>
                      <td className="px-4 py-3.5">
                        <StoreBadge storeId={inv.store_id} storeName={inv.store?.location_name.split(" — ")[1]} size="sm" />
                      </td>
                      <td className="px-4 py-3.5 font-700 text-zinc-800">
                        {formatQuantity(inv.current_quantity, inv.unit)}
                      </td>
                      <td className="px-4 py-3.5">
                        <RiskBadge trigger={inv.trigger} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-zinc-400">{formatDateTime(inv.updated_at)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/inventory/${inv.id}`}>
                          <Button size="sm" variant="secondary">
                            Analyze
                          </Button>
                        </Link>
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
