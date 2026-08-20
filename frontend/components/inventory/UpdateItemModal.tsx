"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createItem, updateItem, updateInventoryItem, createItemBatch } from "@/lib/api/client";
import { Button } from "@/components/ui/primitives";
import { toast } from "sonner";
import type { CurrentInventory } from "@/types";

export interface UpdateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "edit" | "add";
  inventoryItem?: CurrentInventory | null;
  targetStoreId?: number;
}

export function UpdateItemModal({
  isOpen,
  onClose,
  mode = "edit",
  inventoryItem,
  targetStoreId,
}: UpdateItemModalProps) {
  const queryClient = useQueryClient();

  const isAddMode = mode === "add";
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [qtyOnHand, setQtyOnHand] = useState<number | string>(0);
  const [expiryDate, setExpiryDate] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveStoreId = isAddMode
    ? targetStoreId || 1
    : inventoryItem?.store_id || 1;

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (isAddMode) {
        setItemName("");
        setCategory("");
        setUnit("units");
        setQtyOnHand(0);
        setExpiryDate("");
      } else if (inventoryItem) {
        setItemName(inventoryItem.item?.item_name ?? "");
        setCategory(inventoryItem.item?.category ?? "");
        setUnit(inventoryItem.item?.unit ?? "units");
        setQtyOnHand(inventoryItem.qty_on_hand ?? 0);
      }
    }
  }, [isOpen, isAddMode, inventoryItem]);

  if (!isOpen) return null;
  if (!isAddMode && !inventoryItem) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const parsedQty = Number(qtyOnHand);

    if (Number.isNaN(parsedQty) || parsedQty < 0) {
      setErrorMsg("Quantity on hand must be a valid non-negative number.");
      return;
    }

    if (!itemName.trim() || !category.trim()) {
      setErrorMsg("Item Name and Category are required.");
      return;
    }

    setIsPending(true);

    try {
      if (isAddMode) {
        // 1. Create item catalog entry
        const newItem = await createItem({
          item_name: itemName.trim(),
          category: category.trim(),
          unit: unit.trim() || "units",
        });

        // 2. Set initial inventory stock quantity for target store
        await updateInventoryItem(effectiveStoreId, newItem.item_id, parsedQty);

        // 3. If expiry date provided, create an item batch
        if (expiryDate) {
          await createItemBatch({
            store_id: effectiveStoreId,
            item_id: newItem.item_id,
            qty: parsedQty,
            expiry_date: expiryDate,
          });
        }

        toast.success(`Added ${itemName} to Store #${effectiveStoreId} successfully.`);
      } else if (inventoryItem) {
        const storeId = inventoryItem.store_id;
        const itemId = inventoryItem.item_id;

        // 1. Update item attributes if modified
        const itemChanged =
          itemName !== inventoryItem.item?.item_name ||
          category !== inventoryItem.item?.category ||
          unit !== inventoryItem.item?.unit;

        if (itemChanged && itemId) {
          await updateItem(itemId, {
            item_name: itemName.trim(),
            category: category.trim(),
            unit: unit.trim() || "units",
          });
        }

        // 2. Update inventory quantity
        await updateInventoryItem(storeId, itemId, parsedQty);

        toast.success(`Updated ${itemName || "item"} successfully.`);
      }

      // 3. Invalidate query caches to sync UI immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["inventoryItem"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);

      onClose();
    } catch (err: unknown) {
      const message = (err as Error)?.message ?? "Failed to save item.";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white border border-zinc-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <span className="text-[10px] font-mono font-700 text-zinc-400 uppercase tracking-wider">
              {isAddMode
                ? `STORE #${effectiveStoreId}`
                : `STORE #${inventoryItem?.store_id} • ITEM #${inventoryItem?.item_id}`}
            </span>
            <h2 className="text-base font-800 text-zinc-950 uppercase tracking-tight">
              {isAddMode ? "Add Inventory Item" : "Update Inventory Item"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-700 text-zinc-700 uppercase tracking-wider">
              Item Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mango"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-900 font-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-700 text-zinc-700 uppercase tracking-wider">
                Category
              </label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-900 font-500"
              >
                <option value="" disabled>Select category…</option>
                <option value="Grains">Grains</option>
                <option value="Pulses">Pulses</option>
                <option value="Oils & Fats">Oils &amp; Fats</option>
                <option value="Dairy">Dairy</option>
                <option value="Produce">Produce</option>
                <option value="Condiments">Condiments</option>
                <option value="Bakery">Bakery</option>
                <option value="Frozen">Frozen</option>
                <option value="Beverages">Beverages</option>
                <option value="Snacks">Snacks</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-700 text-zinc-700 uppercase tracking-wider">
                Unit of Measure
              </label>
              <select
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-900 font-500"
              >
                <option value="kg">kg</option>
                <option value="L">L (Litre)</option>
                <option value="liter">liter</option>
                <option value="pcs">pcs (Pieces)</option>
                <option value="units">units</option>
                <option value="cases">cases</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-700 text-zinc-700 uppercase tracking-wider">
              {isAddMode ? "Quantity on Hand" : "Current Quantity on Hand"}
            </label>
            <input
              type="number"
              min={0}
              required
              value={qtyOnHand}
              onChange={(e) => setQtyOnHand(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-500 bg-white font-mono text-zinc-950 font-700"
            />
          </div>

          {isAddMode && (
            <div className="space-y-1.5">
              <label className="text-xs font-700 text-zinc-700 uppercase tracking-wider">
                Expiry Date <span className="text-zinc-400 font-500 normal-case">(optional)</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-900 font-500"
              />
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending
                ? isAddMode
                  ? "Adding..."
                  : "Saving..."
                : isAddMode
                ? "Add Item"
                : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
