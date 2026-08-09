/**
 * Centralized API client
 * ─────────────────────────────────────────────────────────────
 * All API interactions go through this module.
 * Set NEXT_PUBLIC_API_BASE_URL to point at the real backend.
 * When not set, the client returns demo fixture data.
 * ─────────────────────────────────────────────────────────────
 */

import type {
  Store,
  Item,
  CurrentInventory,
  DailyPrediction,
  Negotiation,
  Transfer,
  Supplier,
  ActivityEvent,
  ExpiryAlert,
  OrgConfiguration,
  UserSession,
  NegotiationStatus,
  InventoryTrigger,
} from "@/types";

import {
  DEMO_STORES,
  DEMO_ITEMS,
  DEMO_SESSION,
  DEMO_INVENTORY,
  DEMO_PREDICTIONS,
  DEMO_NEGOTIATIONS,
  DEMO_TRANSFERS,
  DEMO_SUPPLIERS,
  DEMO_ACTIVITY,
  DEMO_EXPIRY,
  DEMO_CONFIG,
} from "@/lib/fixtures";

// ─── Config ──────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const IS_DEMO = !BASE_URL;

// ─── HTTP helpers ─────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiClientError(body.error ?? "Request failed", res.status, body.code);
  }
  const json = await res.json();
  return json.data ?? json;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiClientError(err.error ?? "Request failed", res.status, err.code);
  }
  const json = await res.json();
  return json.data ?? json;
}

async function put<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiClientError(err.error ?? "Request failed", res.status, err.code);
  }
  const json = await res.json();
  return json.data ?? json;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiClientError(err.error ?? "Request failed", res.status, err.code);
  }
  const json = await res.json();
  return json.data ?? json;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// ─── Delay helper for demo mode ───────────────────────────────

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

// ─── Auth / Session ───────────────────────────────────────────

export async function getSession(): Promise<UserSession> {
  if (IS_DEMO) { await delay(); return DEMO_SESSION; }
  return get<UserSession>("/api/auth/session");
}

// ─── Stores ──────────────────────────────────────────────────

export async function getStores(): Promise<Store[]> {
  if (IS_DEMO) { await delay(); return DEMO_STORES; }
  return get<Store[]>("/api/stores");
}

export async function getStore(id: number): Promise<Store> {
  if (IS_DEMO) { await delay(); return DEMO_STORES.find((s) => s.store_id === id)!; }
  return get<Store>(`/api/stores/${id}`);
}

// ─── Items ───────────────────────────────────────────────────

export async function getItems(): Promise<Item[]> {
  if (IS_DEMO) { await delay(); return DEMO_ITEMS; }
  return get<Item[]>("/api/items");
}

export async function getItem(id: number): Promise<Item> {
  if (IS_DEMO) { await delay(); return DEMO_ITEMS.find((i) => i.item_id === id)!; }
  return get<Item>(`/api/items/${id}`);
}

export async function createItem(data: Omit<Item, "item_id">): Promise<Item> {
  if (IS_DEMO) { await delay(800); return { item_id: 99, ...data }; }
  return post<Item>("/api/items", data);
}

export async function updateItem(id: number, data: Partial<Item>): Promise<Item> {
  if (IS_DEMO) { await delay(800); return { ...DEMO_ITEMS.find((i) => i.item_id === id)!, ...data }; }
  return put<Item>(`/api/items/${id}`, data);
}

export async function deleteItem(id: number): Promise<void> {
  if (IS_DEMO) { await delay(600); return; }
  return del<void>(`/api/items/${id}`);
}

// ─── Inventory ────────────────────────────────────────────────

export interface InventoryFilters {
  store_id?: number;
  item_id?: number;
  trigger?: InventoryTrigger | "all";
  search?: string;
  page?: number;
  page_size?: number;
}

export async function getInventory(filters?: InventoryFilters): Promise<CurrentInventory[]> {
  if (IS_DEMO) {
    await delay();
    let data = DEMO_INVENTORY;
    if (filters?.store_id) data = data.filter((i) => i.store_id === filters.store_id);
    if (filters?.trigger && filters.trigger !== "all") {
      data = data.filter((i) => i.trigger === filters.trigger);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      data = data.filter(
        (i) =>
          i.item?.item_name.toLowerCase().includes(q) ||
          i.item?.category.toLowerCase().includes(q) ||
          i.store?.location_name.toLowerCase().includes(q),
      );
    }
    return data;
  }
  const params = new URLSearchParams();
  if (filters?.store_id) params.set("store_id", String(filters.store_id));
  if (filters?.trigger && filters.trigger !== "all") params.set("trigger", filters.trigger);
  if (filters?.search) params.set("search", filters.search);
  return get<CurrentInventory[]>(`/api/inventory?${params}`);
}

export async function getInventoryItem(id: number): Promise<CurrentInventory> {
  if (IS_DEMO) { await delay(); return DEMO_INVENTORY.find((i) => i.id === id)!; }
  return get<CurrentInventory>(`/api/inventory/${id}`);
}

export async function updateInventoryItem(id: number, data: Partial<CurrentInventory>): Promise<CurrentInventory> {
  if (IS_DEMO) { await delay(800); return { ...DEMO_INVENTORY.find((i) => i.id === id)!, ...data }; }
  return put<CurrentInventory>(`/api/inventory/${id}`, data);
}

// ─── Predictions ──────────────────────────────────────────────

export async function getPredictions(storeId?: number): Promise<DailyPrediction[]> {
  if (IS_DEMO) {
    await delay();
    return storeId
      ? DEMO_PREDICTIONS.filter((p) => p.store_id === storeId)
      : DEMO_PREDICTIONS;
  }
  const params = storeId ? `?store_id=${storeId}` : "";
  return get<DailyPrediction[]>(`/api/predictions${params}`);
}

// ─── Negotiations ─────────────────────────────────────────────

export interface NegotiationFilters {
  status?: NegotiationStatus | "all";
  store_id?: number;
  item_id?: number;
}

export async function getNegotiations(filters?: NegotiationFilters): Promise<Negotiation[]> {
  if (IS_DEMO) {
    await delay();
    let data = DEMO_NEGOTIATIONS;
    if (filters?.status && filters.status !== "all") {
      data = data.filter((n) => n.status === filters.status);
    }
    if (filters?.store_id) {
      data = data.filter(
        (n) =>
          n.initiating_store_id === filters.store_id ||
          n.context?.participating_store_ids.includes(filters.store_id!),
      );
    }
    return data;
  }
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.store_id) params.set("store_id", String(filters.store_id));
  return get<Negotiation[]>(`/api/negotiations?${params}`);
}

export async function getNegotiation(id: number): Promise<Negotiation> {
  if (IS_DEMO) {
    await delay();
    const neg = DEMO_NEGOTIATIONS.find((n) => n.negotiation_id === id);
    if (!neg) throw new ApiClientError("Negotiation not found", 404, "NOT_FOUND");
    return neg;
  }
  return get<Negotiation>(`/api/negotiations/${id}`);
}

export async function approveTransfer(
  negotiationId: number,
  transferId: number,
): Promise<Transfer> {
  if (IS_DEMO) {
    await delay(1200);
    const t = DEMO_TRANSFERS.find((t) => t.transfer_id === transferId);
    if (!t) throw new ApiClientError("Transfer not found", 404, "NOT_FOUND");
    return { ...t, parties: t.parties.map((p) => ({ ...p, status: "pending" as const })) };
  }
  return post<Transfer>(`/api/negotiations/${negotiationId}/approve`);
}

export async function rejectTransfer(
  negotiationId: number,
): Promise<void> {
  if (IS_DEMO) { await delay(800); return; }
  return post<void>(`/api/negotiations/${negotiationId}/reject`);
}

export async function renegotiate(
  negotiationId: number,
  argument?: string,
): Promise<Negotiation> {
  if (IS_DEMO) {
    await delay(1000);
    const neg = DEMO_NEGOTIATIONS.find((n) => n.negotiation_id === negotiationId);
    return { ...neg!, status: "proposed" };
  }
  return post<Negotiation>(`/api/negotiations/${negotiationId}/renegotiate`, { argument });
}

// ─── Transfers ────────────────────────────────────────────────

export async function getTransfers(storeId?: number): Promise<Transfer[]> {
  if (IS_DEMO) {
    await delay();
    return storeId
      ? DEMO_TRANSFERS.filter(
          (t) => t.source_store_id === storeId || t.destination_store_id === storeId,
        )
      : DEMO_TRANSFERS;
  }
  const params = storeId ? `?store_id=${storeId}` : "";
  return get<Transfer[]>(`/api/transfers${params}`);
}

export async function confirmTransfer(
  transferId: number,
  storeId: number,
): Promise<Transfer> {
  if (IS_DEMO) {
    await delay(1000);
    const t = DEMO_TRANSFERS.find((t) => t.transfer_id === transferId);
    if (!t) throw new ApiClientError("Transfer not found", 404, "NOT_FOUND");
    return {
      ...t,
      parties: t.parties.map((p) =>
        p.store_id === storeId
          ? { ...p, status: "confirmed" as const, confirmed_at: new Date().toISOString() }
          : p,
      ),
    };
  }
  return post<Transfer>(`/api/transfers/${transferId}/confirm`, { store_id: storeId });
}

// ─── Suppliers ────────────────────────────────────────────────

export async function getSuppliers(): Promise<Supplier[]> {
  if (IS_DEMO) { await delay(); return DEMO_SUPPLIERS; }
  return get<Supplier[]>("/api/suppliers");
}

export async function createSupplier(data: Omit<Supplier, "supplier_id">): Promise<Supplier> {
  if (IS_DEMO) { await delay(800); return { supplier_id: 99, ...data }; }
  return post<Supplier>("/api/suppliers", data);
}

export async function updateSupplier(id: number, data: Partial<Supplier>): Promise<Supplier> {
  if (IS_DEMO) {
    await delay(800);
    return { ...DEMO_SUPPLIERS.find((s) => s.supplier_id === id)!, ...data };
  }
  return put<Supplier>(`/api/suppliers/${id}`, data);
}

export async function deleteSupplier(id: number): Promise<void> {
  if (IS_DEMO) { await delay(600); return; }
  return del<void>(`/api/suppliers/${id}`);
}

export async function getSupplierDraft(
  negotiationId: number,
): Promise<{ draft_message: string; deep_link?: string; supplier?: Supplier } | null> {
  if (IS_DEMO) {
    await delay(800);
    return {
      draft_message:
        "Dear Karnataka Grains Wholesale,\n\nWe urgently require 30 kg of Toor Dal for Store 3 (Whitefield). Our current stock has fallen below the reorder threshold with predicted demand of 28 kg in the next 3 days.\n\nPlease confirm availability and earliest delivery.\n\nRegards,\nStore 3 Manager",
      deep_link: "https://wa.me/919876543210?text=",
      supplier: DEMO_SUPPLIERS[0],
    };
  }
  return get(`/api/negotiations/${negotiationId}/supplier-draft`);
}

// ─── Activity ─────────────────────────────────────────────────

export async function getActivity(limit = 20): Promise<ActivityEvent[]> {
  if (IS_DEMO) { await delay(); return DEMO_ACTIVITY.slice(0, limit); }
  return get<ActivityEvent[]>(`/api/activity?limit=${limit}`);
}

// ─── Expiry ───────────────────────────────────────────────────

export async function getExpiryAlerts(storeId?: number): Promise<ExpiryAlert[]> {
  if (IS_DEMO) {
    await delay();
    return storeId
      ? DEMO_EXPIRY.filter((e) => e.store_id === storeId)
      : DEMO_EXPIRY;
  }
  const params = storeId ? `?store_id=${storeId}` : "";
  return get<ExpiryAlert[]>(`/api/expiry${params}`);
}

// ─── Configuration ────────────────────────────────────────────

export async function getConfiguration(): Promise<OrgConfiguration> {
  if (IS_DEMO) { await delay(); return DEMO_CONFIG; }
  return get<OrgConfiguration>("/api/configuration");
}

export async function updateConfiguration(data: Partial<OrgConfiguration>): Promise<OrgConfiguration> {
  if (IS_DEMO) { await delay(800); return { ...DEMO_CONFIG, ...data }; }
  return put<OrgConfiguration>("/api/configuration", data);
}
