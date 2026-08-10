/**
 * DEMO FIXTURE DATA
 * ─────────────────────────────────────────────────────────────
 * This file provides typed demo data for UI development.
 * All API client functions fall back to these fixtures.
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
  ExpiryAlert,
  OrgConfiguration,
} from "@/types";

export const DEMO_STORES: Store[] = [
  { store_id: 1, org_id: 1, location_name: "Store 1 — Koramangala" },
  { store_id: 2, org_id: 1, location_name: "Store 2 — Indiranagar" },
  { store_id: 3, org_id: 1, location_name: "Store 3 — Whitefield" },
  { store_id: 4, org_id: 1, location_name: "Store 4 — HSR Layout" },
];

export const DEMO_ITEMS: Item[] = [
  { item_id: 1, item_name: "Rice", category: "Grains", unit: "kg" },
  { item_id: 2, item_name: "Wheat Flour", category: "Grains", unit: "kg" },
  { item_id: 3, item_name: "Sunflower Oil", category: "Oils & Fats", unit: "L" },
  { item_id: 4, item_name: "Toor Dal", category: "Pulses", unit: "kg" },
  { item_id: 5, item_name: "Sugar", category: "Condiments", unit: "kg" },
  { item_id: 6, item_name: "Salt", category: "Condiments", unit: "kg" },
  { item_id: 7, item_name: "Milk (1L)", category: "Dairy", unit: "pcs" },
  { item_id: 8, item_name: "Bread", category: "Bakery", unit: "pcs" },
];

export const DEMO_PREDICTIONS: DailyPrediction[] = [
  {
    prediction_date: new Date().toISOString().slice(0, 10),
    store_id: 1,
    item_id: 1,
    predicted_demand: 32,
    rop: 20,
    eoq: 80,
    created_at: new Date().toISOString(),
  },
  {
    prediction_date: new Date().toISOString().slice(0, 10),
    store_id: 1,
    item_id: 2,
    predicted_demand: 60,
    rop: 50,
    eoq: 120,
    created_at: new Date().toISOString(),
  },
  {
    prediction_date: new Date().toISOString().slice(0, 10),
    store_id: 3,
    item_id: 4,
    predicted_demand: 28,
    rop: 25,
    eoq: 60,
    created_at: new Date().toISOString(),
  },
  {
    prediction_date: new Date().toISOString().slice(0, 10),
    store_id: 4,
    item_id: 7,
    predicted_demand: 24,
    rop: 15,
    eoq: 48,
    created_at: new Date().toISOString(),
  },
];

export const DEMO_INVENTORY: CurrentInventory[] = [
  {
    store_id: 1,
    item_id: 1,
    qty_on_hand: 18,
    store: DEMO_STORES[0],
    item: DEMO_ITEMS[0],
    prediction: DEMO_PREDICTIONS[0],
  },
  {
    store_id: 1,
    item_id: 2,
    qty_on_hand: 45,
    store: DEMO_STORES[0],
    item: DEMO_ITEMS[1],
    prediction: DEMO_PREDICTIONS[1],
  },
  {
    store_id: 2,
    item_id: 3,
    qty_on_hand: 120,
    store: DEMO_STORES[1],
    item: DEMO_ITEMS[2],
  },
  {
    store_id: 2,
    item_id: 1,
    qty_on_hand: 340,
    store: DEMO_STORES[1],
    item: DEMO_ITEMS[0],
  },
  {
    store_id: 3,
    item_id: 4,
    qty_on_hand: 22,
    store: DEMO_STORES[2],
    item: DEMO_ITEMS[3],
    prediction: DEMO_PREDICTIONS[2],
  },
  {
    store_id: 1,
    item_id: 5,
    qty_on_hand: 200,
    store: DEMO_STORES[0],
    item: DEMO_ITEMS[4],
  },
  {
    store_id: 4,
    item_id: 7,
    qty_on_hand: 8,
    store: DEMO_STORES[3],
    item: DEMO_ITEMS[6],
    prediction: DEMO_PREDICTIONS[3],
  },
];

const t = (offsetMs: number) =>
  new Date(Date.now() - offsetMs).toISOString();

export const DEMO_NEGOTIATIONS: Negotiation[] = [
  {
    negotiation_id: 1,
    org_id: 1,
    item_id: 1,
    initiating_store_id: 1,
    trigger_type: "immediately_low",
    status: "completed",
    resolution_type: "transfer",
    created_at: t(3600000 * 4),
    updated_at: t(3600000 * 1),
    item: DEMO_ITEMS[0],
    initiating_store: DEMO_STORES[0],
    turns: [
      {
        turn_id: 1,
        negotiation_id: 1,
        store_id: 1,
        turn_number: 1,
        argument_text:
          "Store 1 urgently needs 40 kg of Rice. Current stock is critically low at 18 kg, with predicted demand of 32 kg. Without a transfer within 2 hours, we will stock out. Store 3 has reported 45 kg of usable surplus above their own reorder point.",
        responded: true,
        created_at: t(3600000 * 3),
      },
      {
        turn_id: 2,
        negotiation_id: 1,
        store_id: 3,
        turn_number: 2,
        argument_text:
          "Store 3 acknowledges the urgency. We can contribute 25 kg — this keeps us above our own reorder point of 20 kg with a comfortable buffer. Transfer time to Store 1 is estimated at 2 hours, within the critical window.",
        responded: true,
        created_at: t(3600000 * 2.5),
      },
      {
        turn_id: 3,
        negotiation_id: 1,
        store_id: 2,
        turn_number: 3,
        argument_text:
          "Store 2 can provide an additional 15 kg from surplus. Combined with Store 3's 25 kg, Store 1 receives 40 kg total — meeting predicted demand with margin.",
        responded: true,
        created_at: t(3600000 * 2),
      },
      {
        turn_id: 4,
        negotiation_id: 1,
        store_id: null,
        turn_number: 4,
        argument_text:
          "Arbitrator Decision: Transfer approved. Store 2 will supply 40 kg of Rice to Store 1. Store 3's offer is held in reserve. Transfer time: 2 hours. This resolves the immediate stockout risk for Store 1.",
        responded: true,
        created_at: t(3600000 * 1.5),
      },
    ],
  },
  {
    negotiation_id: 2,
    org_id: 1,
    item_id: 2,
    initiating_store_id: 1,
    trigger_type: "might_be_low",
    status: "proposed",
    created_at: t(2400000),
    updated_at: t(1800000),
    item: DEMO_ITEMS[1],
    initiating_store: DEMO_STORES[0],
    turns: [
      {
        turn_id: 5,
        negotiation_id: 2,
        store_id: 1,
        turn_number: 1,
        argument_text:
          "Prediction indicates wheat flour demand will reach 60 kg in the next 4 days. Current stock at 45 kg is below the reorder point of 50 kg. Requesting 30 kg from the network to meet predicted demand safely.",
        responded: true,
        created_at: t(1800000),
      },
    ],
  },
  {
    negotiation_id: 3,
    org_id: 1,
    item_id: 4,
    initiating_store_id: 3,
    trigger_type: "might_be_low",
    status: "rejected",
    resolution_type: "supplier",
    created_at: t(3600000 * 24),
    updated_at: t(3600000 * 23.5),
    item: DEMO_ITEMS[3],
    initiating_store: DEMO_STORES[2],
    turns: [
      {
        turn_id: 6,
        negotiation_id: 3,
        store_id: 3,
        turn_number: 1,
        argument_text:
          "Store 3 stock has fallen to 22 kg (ROP 25 kg). Usable surplus scan returned 0 kg from regional peers. Escalating restock order to external distributors.",
        responded: true,
        created_at: t(3600000 * 24),
      },
      {
        turn_id: 7,
        negotiation_id: 3,
        store_id: null,
        turn_number: 2,
        argument_text:
          "Arbitrator Decision: Local store networks report zero usable surplus of Toor Dal. Recommended resolution path: External Supplier Restock Order.",
        responded: true,
        created_at: t(3600000 * 23.8),
      },
    ],
  },
];

export const DEMO_TRANSFERS: Transfer[] = [
  {
    transfer_id: 1,
    negotiation_id: 1,
    from_store_id: 2,
    to_store_id: 1,
    item_id: 1,
    qty: 40,
    from_confirmed: true,
    to_confirmed: false,
    is_complete: false,
    created_at: t(3600000 * 1.5),
    updated_at: t(3600000 * 0.5),
    item: DEMO_ITEMS[0],
    source_store: DEMO_STORES[1],
    destination_store: DEMO_STORES[0],
  },
  {
    transfer_id: 2,
    negotiation_id: 1,
    from_store_id: 3,
    to_store_id: 1,
    item_id: 4,
    qty: 25,
    from_confirmed: true,
    to_confirmed: true,
    is_complete: true,
    created_at: t(3600000 * 48),
    updated_at: t(3600000 * 46),
    item: DEMO_ITEMS[3],
    source_store: DEMO_STORES[2],
    destination_store: DEMO_STORES[0],
  },
];

export const DEMO_SUPPLIERS: Supplier[] = [
  {
    supplier_id: 1,
    store_id: 1,
    item_id: 1,
    name: "Karnataka Grains Wholesale",
    phone: "+919876543210",
    email: "wholesale@karnatakagrains.in",
    pref: "whatsapp",
  },
  {
    supplier_id: 2,
    store_id: 1,
    item_id: 3,
    name: "Safal Oils & Fats Depot",
    phone: "+918765432109",
    email: "safaloils@safal.co.in",
    pref: "email",
  },
  {
    supplier_id: 3,
    store_id: 2,
    item_id: 7,
    name: "Nandini Dairy Distributors",
    phone: "+917654321098",
    email: "nandinidairy@kmf.coop",
    pref: "whatsapp",
  },
];

export const DEMO_EXPIRY: ExpiryAlert[] = [
  {
    batch_id: 101,
    store_id: 1,
    item_id: 7,
    qty: 12,
    expiry_date: new Date(Date.now() + 86400000 * 1).toISOString(),
    days_until_expiry: 1,
    store: DEMO_STORES[0],
    item: DEMO_ITEMS[6],
  },
  {
    batch_id: 102,
    store_id: 1,
    item_id: 8,
    qty: 25,
    expiry_date: new Date(Date.now() + 86400000 * 3).toISOString(),
    days_until_expiry: 3,
    store: DEMO_STORES[0],
    item: DEMO_ITEMS[7],
  },
  {
    batch_id: 103,
    store_id: 2,
    item_id: 7,
    qty: 18,
    expiry_date: new Date(Date.now() + 86400000 * 6).toISOString(),
    days_until_expiry: 6,
    store: DEMO_STORES[1],
    item: DEMO_ITEMS[6],
  },
];

export const DEMO_CONFIG: OrgConfiguration = {
  org_id: 1,
  batch_x: 50,
  max_negotiation_turns: 6,
};
