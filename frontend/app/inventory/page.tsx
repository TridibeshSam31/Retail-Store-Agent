"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import {
  getInventory,
  getStores,
  getItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "@/lib/api/client";
import { RiskBadge, StoreBadge } from "@/components/ui/badges";
import { TableSkeleton, EmptyState, Button } from "@/components/ui/primitives";
import { formatQuantity, formatDateTime } from "@/lib/formatting";
import Link from "next/link";
import { UpdateItemModal } from "@/components/inventory/UpdateItemModal";
import type { CurrentInventory, InventoryTrigger } from "@/types";

export default function InventoryPage() {
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [modalItem, setModalItem] = useState<CurrentInventory | null>(null);

  const queryClient = useQueryClient();

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: () => getStores(),
  });

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => getItems(),
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["inventory"] });

  const addMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      invalidate();
      setShowAddForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ storeId, itemId }: { storeId: number; itemId: number }) =>
      deleteInventoryItem(storeId, itemId),
    onSuccess: invalidate,
  });

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    addMutation.mutate({
      store_id: Number(form.get("store_id")),
      item_id: Number(form.get("item_id")),
      qty_on_hand: Number(form.get("qty_on_hand")),
    });
  };

  const handleDelete = (storeId: number, itemId: number, itemName?: string) => {
    if (!window.confirm(`Remove ${itemName ?? "this item"} from inventory at this store?`)) return;
    deleteMutation.mutate({ storeId, itemId });
  };

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
            <Button size="sm" onClick={() => setShowAddForm((v) => !v)}>
              {showAddForm ? "Cancel" : "Add Item"}
            </Button>
          </div>
        </div>

        {/* Add Item Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col md:flex-row gap-3 items-end shadow-sm"
          >
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-[11px] font-600 text-zinc-400 uppercase">Store</label>
              <select name="store_id" required className="px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700">
                {stores?.map((s) => (
                  <option key={s.store_id} value={s.store_id}>
                    {s.location_name.split(" — ")[1] ?? s.location_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-[11px] font-600 text-zinc-400 uppercase">Item</label>
              <select name="item_id" required className="px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700">
                {items?.map((i) => (
                  <option key={i.item_id} value={i.item_id}>
                    {i.item_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <label className="text-[11px] font-600 text-zinc-400 uppercase">Qty on Hand</label>
              <input
                name="qty_on_hand"
                type="number"
                min={0}
                required
                className="px-2 py-1.5 text-xs border border-zinc-200 rounded-md bg-zinc-50 text-zinc-800 w-28"
              />
            </div>
            <Button size="sm" type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </form>
        )}

        {/* Filters Panel */}
        <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
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
            <TableSkeleton cols={7} rows={6} />
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
                  {inventory?.map((inv) => {
                    const key = `${inv.store_id}-${inv.item_id}`;
                    return (
                      <tr key={key} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-4 py-3.5">
                          <Link href={`/inventory/${inv.item_id}`} className="font-600 text-zinc-950 hover:underline">
                            {inv.item?.item_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-zinc-500">{inv.item?.category}</td>
                        <td className="px-4 py-3.5">
                          <StoreBadge storeId={inv.store_id} storeName={inv.store?.location_name.split(" — ")[1]} size="sm" />
                        </td>
                        <td className="px-4 py-3.5 font-700 text-zinc-800">
                          {formatQuantity(inv.qty_on_hand, inv.item?.unit ?? "units")}
                        </td>
                        <td className="px-4 py-3.5">
                          <RiskBadge trigger={inv.prediction ? (inv.qty_on_hand <= inv.prediction.rop ? "immediately_low" : "might_be_low") : null} />
                        </td>
                        <td className="px-4 py-3.5 text-xs text-zinc-400">{formatDateTime(new Date().toISOString())}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setModalItem(inv)}
                              className="text-xs text-indigo-600 font-600 hover:underline"
                            >
                              Update
                            </button>
                            <Link href={`/inventory/${inv.item_id}`}>
                              <Button size="sm" variant="secondary">
                                Analyze
                              </Button>
                            </Link>
                            <button
                              onClick={() => handleDelete(inv.store_id, inv.item_id, inv.item?.item_name)}
                              disabled={deleteMutation.isPending}
                              className="text-xs text-red-500 hover:underline font-600"
                            >
                              Delete
                            </button>
                          </div>
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

      <UpdateItemModal
        isOpen={!!modalItem}
        onClose={() => setModalItem(null)}
        inventoryItem={modalItem}
      />
    </AppShell>
  );
}