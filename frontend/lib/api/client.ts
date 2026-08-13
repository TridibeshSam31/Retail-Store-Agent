/**
 * Centralized API client
 * ─────────────────────────────────────────────────────────────
 * All API interactions go through this module.
 * Set NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_API_BASE_URL) to point at the real backend.
 * When not set, the client returns demo fixture data.
 * ─────────────────────────────────────────────────────────────
 */

import type {
  Store,
  Org,
  Item,
  CurrentInventory,
  DailyPrediction,
  Negotiation,
  Transfer,
  Supplier,
  ExpiryAlert,
  OrgConfiguration,
  UserSession,
  NegotiationStatus,
  InventoryTrigger,
  SupplierContactDraft,
  ActivityEvent,
} from "@/types";

import {
  DEMO_STORES,
  DEMO_ITEMS,
  DEMO_INVENTORY,
  DEMO_PREDICTIONS,
  DEMO_NEGOTIATIONS,
  DEMO_TRANSFERS,
  DEMO_SUPPLIERS,
  DEMO_EXPIRY,
  DEMO_CONFIG,
} from "@/lib/fixtures";

// ─── Config ──────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
const IS_DEMO = !(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL);

// ─── Header Injection ─────────────────────────────────────────

function getHeaders(requireOrgId = true, requireStoreId = false): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    if (requireOrgId) {
      const orgId = localStorage.getItem("org_id");
      if (orgId) {
        headers["X-Org-Id"] = orgId;
      }
    }
    if (requireStoreId) {
      const storeId = localStorage.getItem("store_id");
      if (storeId) {
        headers["X-Store-Id"] = storeId;
      }
    }
  }

  return headers;
}

// ─── HTTP helpers ─────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: unknown) {
    const errorName = (err as Error)?.name;
    if (errorName === "AbortError") {
      throw new ApiClientError(`Request timeout connecting to backend at ${BASE_URL}`, 504, "TIMEOUT");
    }
    throw new ApiClientError(`Backend server unavailable at ${BASE_URL}`, 503, "SERVER_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(path: string, requireOrgId = true, requireStoreId = false): Promise<T> {
  const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    headers: getHeaders(requireOrgId, requireStoreId),
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiClientError(body.detail ?? body.error ?? "Request failed", res.status, body.code);
  }
  return res.json();
}

async function post<T>(path: string, body?: unknown, requireOrgId = true, requireStoreId = false): Promise<T> {
  const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: "POST",
    headers: getHeaders(requireOrgId, requireStoreId),
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiClientError(err.detail ?? err.error ?? "Request failed", res.status, err.code);
  }
  return res.json();
}

async function put<T>(path: string, body?: unknown, requireOrgId = true, requireStoreId = false): Promise<T> {
  const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: getHeaders(requireOrgId, requireStoreId),
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiClientError(err.detail ?? err.error ?? "Request failed", res.status, err.code);
  }
  return res.json();
}

async function del<T>(path: string, requireOrgId = true, requireStoreId = false): Promise<T> {
  const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: getHeaders(requireOrgId, requireStoreId),
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiClientError(err.detail ?? err.error ?? "Request failed", res.status, err.code);
  }
  return res.json();
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

// ─── Identity / Login ─────────────────────────────────────────

export async function getOrgs(): Promise<Org[]> {
  if (IS_DEMO) {
    await delay();
    return [{ org_id: 1, org_name: "RetailCo India" }];
  }
  return get<Org[]>("/identity/orgs", false, false);
}

export async function getStoresForPicker(orgId: number): Promise<Store[]> {
  if (IS_DEMO) {
    await delay();
    return DEMO_STORES.map(s => ({ ...s, org_id: orgId }));
  }
  return get<Store[]>(`/identity/stores?org_id=${orgId}`, false, false);
}

export async function selectIdentity(orgId: number, storeId: number): Promise<UserSession> {
  if (IS_DEMO) {
    await delay();
    return {
      org_id: orgId,
      store_id: storeId,
      location_name: DEMO_STORES.find(s => s.store_id === storeId)?.location_name ?? "Store 1",
      expiry_alerts: DEMO_EXPIRY,
    };
  }
  return post<UserSession>(`/identity/select?org_id=${orgId}&store_id=${storeId}`, null, false, false);
}

// ─── Config Panel (Orgs & Stores) ──────────────────────────────

export async function createOrg(orgName: string): Promise<Org> {
  if (IS_DEMO) { await delay(); return { org_id: 99, org_name: orgName }; }
  return post<Org>("/orgs", { org_name: orgName }, false, false);
}

export async function deleteOrg(id: number): Promise<void> {
  if (IS_DEMO) { await delay(); return; }
  return del<void>(`/orgs/${id}`, false, false);
}

export async function createStore(data: { org_id: number; location_name: string; latitude?: number; longitude?: number }): Promise<Store> {
  if (IS_DEMO) { await delay(); return { store_id: 99, ...data }; }
  return post<Store>("/stores", data, false, false);
}

export async function deleteStore(id: number): Promise<void> {
  if (IS_DEMO) { await delay(); return; }
  return del<void>(`/stores/${id}`, false, false);
}

// ─── Stores ──────────────────────────────────────────────────

export async function getStores(): Promise<Store[]> {
  if (IS_DEMO) { await delay(); return DEMO_STORES.map(s => ({ ...s, org_id: 1 })); }
  return get<Store[]>("/stores");
}

export async function getStore(id: number): Promise<Store> {
  if (IS_DEMO) { await delay(); return DEMO_STORES.map(s => ({ ...s, org_id: 1 })).find((s) => s.store_id === id)!; }
  return get<Store>(`/stores/${id}`);
}

// ─── Items ───────────────────────────────────────────────────

export async function getItems(): Promise<Item[]> {
  if (IS_DEMO) { await delay(); return DEMO_ITEMS; }
  return get<Item[]>("/items");
}

export async function getItem(id: number): Promise<Item> {
  if (IS_DEMO) { await delay(); return DEMO_ITEMS.find((i) => i.item_id === id)!; }
  return get<Item>(`/items/${id}`);
}

export async function createItem(data: Omit<Item, "item_id">): Promise<Item> {
  if (IS_DEMO) { await delay(800); return { item_id: 99, ...data }; }
  return post<Item>("/items", data);
}

export async function updateItem(id: number, data: Partial<Item>): Promise<Item> {
  if (IS_DEMO) { await delay(800); return { ...DEMO_ITEMS.find((i) => i.item_id === id)!, ...data }; }
  return put<Item>(`/items/${id}`, data);
}

export async function deleteItem(id: number): Promise<void> {
  if (IS_DEMO) { await delay(600); return; }
  return del<void>(`/items/${id}`);
}

// ─── Inventory ────────────────────────────────────────────────

export interface InventoryFilters {
  store_id?: number;
  item_id?: number;
  trigger?: InventoryTrigger | "all";
  search?: string;
}

export async function getInventory(filters?: InventoryFilters): Promise<CurrentInventory[]> {
  let data: CurrentInventory[];
  
  if (IS_DEMO) {
    await delay();
    data = DEMO_INVENTORY;
  } else {
    if (filters?.store_id) {
      data = await get<CurrentInventory[]>(`/inventory/store/${filters.store_id}`);
    } else {
      data = await get<CurrentInventory[]>("/inventory");
    }

    const [items, stores, predictions] = await Promise.all([
      getItems().catch(() => []),
      getStores().catch(() => []),
      getPredictions().catch(() => []),
    ]);

    const itemMap = new Map(items.map((i) => [i.item_id, i]));
    const storeMap = new Map(stores.map((s) => [s.store_id, s]));
    const predMap = new Map(predictions.map((p) => [`${p.store_id}-${p.item_id}`, p]));

    data = data.map((inv) => ({
      ...inv,
      item: inv.item ?? itemMap.get(inv.item_id),
      store: inv.store ?? storeMap.get(inv.store_id),
      prediction: inv.prediction ?? predMap.get(`${inv.store_id}-${inv.item_id}`),
    }));
  }

  // Common client-side filtering
  if (filters?.store_id) {
    data = data.filter((i) => i.store_id === filters.store_id);
  }
  if (filters?.trigger && filters.trigger !== "all") {
    data = data.filter((i) => {
      const trigger = i.prediction ? (i.qty_on_hand <= i.prediction.rop ? "immediately_low" : "might_be_low") : null;
      return trigger === filters.trigger;
    });
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

export async function getInventoryItem(storeId: number, itemId: number): Promise<CurrentInventory> {
  if (IS_DEMO) {
    await delay();
    return DEMO_INVENTORY.find((i) => i.store_id === storeId && i.item_id === itemId)!;
  }

  const [inv, item, store, prediction, stockout, surplus] = await Promise.all([
    get<CurrentInventory>(`/inventory/${storeId}/${itemId}`),
    getItem(itemId).catch(() => undefined),
    getStore(storeId).catch(() => undefined),
    getPrediction(storeId, itemId).catch(() => undefined),
    getTimeToStockout(storeId, itemId).catch(() => null),
    getUsableSurplus(storeId, itemId).catch(() => 0),
  ]);

  return {
    ...inv,
    item: inv.item ?? item,
    store: inv.store ?? store,
    prediction: inv.prediction ?? prediction,
    time_to_stockout: stockout,
    usable_surplus: surplus,
  };
}

export async function updateInventoryItem(storeId: number, itemId: number, qtyOnHand: number): Promise<CurrentInventory> {
  if (IS_DEMO) {
    await delay(800);
    const item = DEMO_INVENTORY.find((i) => i.store_id === storeId && i.item_id === itemId)!;
    item.qty_on_hand = qtyOnHand;
    return item;
  }
  return put<CurrentInventory>(`/inventory/${storeId}/${itemId}`, { qty_on_hand: qtyOnHand });
}

export async function createInventoryItem(data: {
  store_id: number;
  item_id: number;
  qty_on_hand: number;
}): Promise<CurrentInventory> {
  if (IS_DEMO) {
    await delay(800);
    const newItem = { ...data } as CurrentInventory;
    DEMO_INVENTORY.push(newItem);
    return newItem;
  }
  return post<CurrentInventory>("/inventory", data, true, false);
}

export async function deleteInventoryItem(storeId: number, itemId: number): Promise<void> {
  if (IS_DEMO) {
    await delay(600);
    const idx = DEMO_INVENTORY.findIndex((i) => i.store_id === storeId && i.item_id === itemId);
    if (idx > -1) DEMO_INVENTORY.splice(idx, 1);
    return;
  }
  return del<void>(`/inventory/${storeId}/${itemId}`, true, false);
}

// ─── Analytics ────────────────────────────────────────────────

export async function getUsableSurplus(storeId: number, itemId: number): Promise<number> {
  if (IS_DEMO) {
    await delay();
    return 15;
  }
  const res = await get<{ store_id: number; item_id: number; usable_surplus: number }>(
    `/analytics/usable-surplus/${storeId}/${itemId}`
  );
  return res.usable_surplus;
}

export async function getUsableSurplusForStore(storeId: number): Promise<{ item_id: number; usable_surplus: number }[]> {
  if (IS_DEMO) {
    await delay();
    return DEMO_INVENTORY.filter((i) => i.store_id === storeId).map((i) => ({ item_id: i.item_id, usable_surplus: 15 }));
  }
  return get<{ item_id: number; usable_surplus: number }[]>(`/analytics/usable-surplus/store/${storeId}`);
}

export async function getUsableSurplusForItem(itemId: number): Promise<{ store_id: number; usable_surplus: number }[]> {
  if (IS_DEMO) {
    await delay();
    return DEMO_INVENTORY.filter((i) => i.item_id === itemId).map((i) => ({ store_id: i.store_id, usable_surplus: 15 }));
  }
  return get<{ store_id: number; usable_surplus: number }[]>(`/analytics/usable-surplus/item/${itemId}`);
}

export async function getTimeToStockout(storeId: number, itemId: number): Promise<number | null> {
  if (IS_DEMO) {
    await delay();
    return 3.5;
  }
  const res = await get<{ store_id: number; item_id: number; days_to_stockout: number | null }>(
    `/analytics/time-to-stockout/${storeId}/${itemId}`
  );
  return res.days_to_stockout;
}

// ─── Predictions ──────────────────────────────────────────────

export async function getPredictions(storeId?: number): Promise<DailyPrediction[]> {
  if (IS_DEMO) {
    await delay();
    return storeId
      ? DEMO_PREDICTIONS.filter((p) => p.store_id === storeId)
      : DEMO_PREDICTIONS;
  }
  if (storeId) {
    return get<DailyPrediction[]>(`/predictions/store/${storeId}`);
  }
  return get<DailyPrediction[]>("/predictions");
}

export async function getPrediction(storeId: number, itemId: number): Promise<DailyPrediction> {
  if (IS_DEMO) {
    await delay();
    const p = DEMO_PREDICTIONS.find((pred) => pred.store_id === storeId && pred.item_id === itemId);
    if (!p) throw new ApiClientError("Prediction not found", 404, "NOT_FOUND");
    return p;
  }
  return get<DailyPrediction>(`/predictions/${storeId}/${itemId}`);
}

// ─── Negotiations ─────────────────────────────────────────────

export interface NegotiationFilters {
  status?: NegotiationStatus | "all";
  store_id?: number;
}

export async function getNegotiations(filters?: NegotiationFilters): Promise<Negotiation[]> {
  let data: Negotiation[];
  if (IS_DEMO) {
    await delay();
    data = DEMO_NEGOTIATIONS;
  } else {
    if (filters?.store_id) {
      data = await get<Negotiation[]>(`/negotiations/store/${filters.store_id}`);
    } else {
      data = await get<Negotiation[]>("/negotiations");
    }

    const [items, stores] = await Promise.all([
      getItems().catch(() => []),
      getStores().catch(() => []),
    ]);

    const itemMap = new Map(items.map((i) => [i.item_id, i]));
    const storeMap = new Map(stores.map((s) => [s.store_id, s]));

    data = data.map((n) => {
      const initStoreId = n.initiator_store_id ?? n.initiating_store_id;
      const initStore = storeMap.get(initStoreId);
      return {
        ...n,
        initiating_store_id: initStoreId,
        item: n.item ?? itemMap.get(n.item_id),
        initiating_store: n.initiating_store ?? initStore,
      };
    });
  }

  if (filters?.status && filters.status !== "all") {
    data = data.filter((n) => n.status === filters.status);
  }
  if (filters?.store_id) {
    data = data.filter((n) => (n.initiator_store_id ?? n.initiating_store_id) === filters.store_id);
  }
  return data;
}

export async function getNegotiation(id: number): Promise<Negotiation> {
  if (IS_DEMO) {
    await delay();
    const neg = DEMO_NEGOTIATIONS.find((n) => n.negotiation_id === id);
    if (!neg) throw new ApiClientError("Negotiation not found", 404, "NOT_FOUND");
    return neg;
  }

  const neg = await get<Negotiation>(`/negotiations/${id}`);
  const initStoreId = neg.initiator_store_id ?? neg.initiating_store_id;

  const [item, store] = await Promise.all([
    getItem(neg.item_id).catch(() => undefined),
    getStore(initStoreId).catch(() => undefined),
  ]);

  return {
    ...neg,
    initiating_store_id: initStoreId,
    item: neg.item ?? item,
    initiating_store: neg.initiating_store ?? store,
  };
}

export async function approveTransfer(negotiationId: number): Promise<void> {
  if (IS_DEMO) {
    await delay(1000);
    return;
  }
  return post<void>(`/negotiations/${negotiationId}/approve`);
}

export async function rejectTransfer(negotiationId: number, action: "renegotiate" | "escalate" = "escalate"): Promise<void> {
  if (IS_DEMO) {
    await delay(800);
    return;
  }
  return post<void>(`/negotiations/${negotiationId}/reject`, { action });
}

export async function addNegotiationTurn(
  negotiationId: number,
  data: { store_id: number; turn_number: number; argument_text?: string; responded?: boolean }
): Promise<void> {
  if (IS_DEMO) {
    await delay(800);
    return;
  }
  return post<void>(`/negotiations/${negotiationId}/turns`, data);
}

export async function cancelNegotiation(negotiationId: number): Promise<void> {
  if (IS_DEMO) {
    await delay(600);
    return;
  }
  return post<void>(`/negotiations/${negotiationId}/cancel`);
}

// ─── Transfers ────────────────────────────────────────────────

export async function getTransfers(storeId?: number): Promise<Transfer[]> {
  let data: Transfer[];
  if (IS_DEMO) {
    await delay();
    data = storeId
      ? DEMO_TRANSFERS.filter(
          (t) => t.from_store_id === storeId || t.to_store_id === storeId,
        )
      : DEMO_TRANSFERS;
  } else {
    if (storeId) {
      data = await get<Transfer[]>(`/transfers/store/${storeId}`);
    } else {
      data = await get<Transfer[]>("/transfers");
    }

    const [items, stores] = await Promise.all([
      getItems().catch(() => []),
      getStores().catch(() => []),
    ]);

    const itemMap = new Map(items.map((i) => [i.item_id, i]));
    const storeMap = new Map(stores.map((s) => [s.store_id, s]));

    data = data.map((t) => ({
      ...t,
      from_confirmed: t.from_confirmed ?? t.confirmed_from ?? false,
      to_confirmed: t.to_confirmed ?? t.confirmed_to ?? false,
      is_complete: t.is_complete ?? Boolean(t.completed_at),
      item: t.item ?? itemMap.get(t.item_id),
      source_store: t.source_store ?? storeMap.get(t.from_store_id),
      destination_store: t.destination_store ?? storeMap.get(t.to_store_id),
    }));
  }

  return data;
}

export async function confirmTransferShipment(transferId: number): Promise<Transfer> {
  if (IS_DEMO) {
    await delay(1000);
    const t = DEMO_TRANSFERS.find((t) => t.transfer_id === transferId);
    if (!t) throw new ApiClientError("Transfer not found", 404, "NOT_FOUND");
    t.from_confirmed = true;
    t.to_confirmed = true;
    t.is_complete = true;
    return t;
  }
  // This confirm route requires X-Store-Id header
  return post<Transfer>(`/transfers/${transferId}/confirm`, null, true, true);
}

// ─── Suppliers & Contact Drafts ────────────────────────────────

export async function getSuppliers(storeId?: number): Promise<Supplier[]> {
  if (IS_DEMO) { await delay(); return DEMO_SUPPLIERS; }
  if (storeId) {
    return get<Supplier[]>(`/suppliers/store/${storeId}`);
  }
  return get<Supplier[]>("/suppliers");
}

export async function createSupplier(data: Omit<Supplier, "supplier_id">): Promise<Supplier> {
  if (IS_DEMO) { await delay(800); return { supplier_id: 99, ...data }; }
  return post<Supplier>("/suppliers", data);
}

export async function updateSupplier(id: number, data: Partial<Supplier>): Promise<Supplier> {
  if (IS_DEMO) {
    await delay(800);
    return { ...DEMO_SUPPLIERS.find((s) => s.supplier_id === id)!, ...data };
  }
  return put<Supplier>(`/suppliers/${id}`, data);
}

export async function deleteSupplier(id: number): Promise<void> {
  if (IS_DEMO) { await delay(600); return; }
  return del<void>(`/suppliers/${id}`);
}

export async function getSupplierDraft(negotiationId: number): Promise<SupplierContactDraft> {
  if (IS_DEMO) {
    await delay(800);
    return {
      has_supplier: true,
      message:
        "Dear Karnataka Grains Wholesale,\n\nWe urgently require 30 kg of Toor Dal for Store 3 (Whitefield). Our current stock has fallen below the reorder threshold with predicted demand of 28 kg in the next 3 days.\n\nPlease confirm availability and earliest delivery.\n\nRegards,\nStore 3 Manager",
      channel: "whatsapp",
      link: "https://wa.me/919876543210?text=",
    };
  }
  return get<SupplierContactDraft>(`/supplier-contact/${negotiationId}`);
}

export async function markSupplierDraftSent(negotiationId: number): Promise<void> {
  if (IS_DEMO) {
    await delay(600);
    return;
  }
  return post<void>(`/supplier-contact/${negotiationId}/sent`);
}

// ─── Expiry ───────────────────────────────────────────────────

export async function getExpiryAlerts(storeId?: number): Promise<ExpiryAlert[]> {
  if (IS_DEMO) {
    await delay();
    return storeId
      ? DEMO_EXPIRY.filter((e) => e.store_id === storeId)
      : DEMO_EXPIRY;
  }

  let batches: ExpiryAlert[];
  if (storeId) {
    batches = await get<ExpiryAlert[]>(`/item-batches/expiring/store/${storeId}`);
  } else {
    batches = await get<ExpiryAlert[]>("/item-batches/expiring");
  }

  const [items, stores] = await Promise.all([
    getItems().catch(() => []),
    getStores().catch(() => []),
  ]);

  const itemMap = new Map(items.map((i) => [i.item_id, i]));
  const storeMap = new Map(stores.map((s) => [s.store_id, s]));

  const today = new Date();

  return batches.map((b) => {
    let daysUntil: number | undefined = undefined;
    if (b.expiry_date) {
      const expDate = new Date(b.expiry_date);
      const diffTime = expDate.getTime() - today.getTime();
      daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return {
      ...b,
      item: b.item ?? itemMap.get(b.item_id),
      store: b.store ?? storeMap.get(b.store_id),
      days_until_expiry: b.days_until_expiry ?? daysUntil,
    };
  });
}

// ─── Configuration ────────────────────────────────────────────

export async function getConfiguration(): Promise<OrgConfiguration> {
  if (IS_DEMO) { await delay(); return DEMO_CONFIG; }
  return get<OrgConfiguration>("/config");
}

export async function updateConfiguration(data: Partial<OrgConfiguration>): Promise<OrgConfiguration> {
  if (IS_DEMO) { await delay(800); return { ...DEMO_CONFIG, ...data }; }
  return put<OrgConfiguration>("/config", data);
}

// ─── Activity timeline feed ───────────────────────────────────

export async function getActivity(limit = 20): Promise<ActivityEvent[]> {
  // Activity Event timeline is driven by /negotiations history feed
  if (IS_DEMO) {
    await delay();
    return DEMO_NEGOTIATIONS.slice(0, limit).map(n => ({
      event_id: n.negotiation_id,
      event_type: n.status === "completed" ? "negotiation_completed" : "negotiation_started",
      negotiation_id: n.negotiation_id,
      description: `Negotiation #${n.negotiation_id} status updated to ${n.status}`,
      created_at: n.created_at,
      store_id: n.initiating_store_id ?? n.initiator_store_id,
      store: n.initiating_store,
    }));
  }
  const negotiations = await getNegotiations();
  return negotiations.slice(0, limit).map(n => ({
    event_id: n.negotiation_id,
    event_type: n.status === "completed" ? "negotiation_completed" : "negotiation_started",
    negotiation_id: n.negotiation_id,
    description: `Negotiation #${n.negotiation_id} status updated to ${n.status}`,
    created_at: n.created_at,
    store_id: n.initiating_store_id ?? n.initiator_store_id,
    store: n.initiating_store,
  }));
}
