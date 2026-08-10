// ============================================================
// Identity & Session Types
// ============================================================

export interface Org {
  org_id: number;
  org_name: string;
}

export interface Store {
  store_id: number;
  org_id: number;
  location_name: string;
  latitude?: number;
  longitude?: number;
}

export interface UserSession {
  org_id: number;
  store_id: number;
  location_name: string;
  expiry_alerts: ExpiryAlert[];
}

// ============================================================
// Core Database Entity Types
// ============================================================

export interface StoreDistance {
  store_id_a: number;
  store_id_b: number;
  tier: "near" | "medium" | "far";
  est_hours: number;
}

export interface Item {
  item_id: number;
  item_name: string;
  category: string;
  unit: string;
}

export interface InventoryMetadata {
  store_id: number;
  item_id: number;
  order_cost: number;
  annual_holding_cost: number;
  lead_time_days: number;
}

export interface CurrentInventory {
  store_id: number;
  item_id: number;
  qty_on_hand: number;
  // Joined fields for frontend presentation convenience
  item?: Item;
  store?: Store;
  prediction?: DailyPrediction;
  time_to_stockout?: number | null; // from /analytics/time-to-stockout
}

export interface ExpiryAlert {
  batch_id: number;
  store_id: number;
  item_id: number;
  qty: number;
  expiry_date?: string; // YYYY-MM-DD
  // Joined fields for frontend
  item?: Item;
  store?: Store;
  days_until_expiry?: number;
}

export interface RawTransaction {
  transaction_id: number;
  date: string; // YYYY-MM-DD
  store_id: number;
  item_id: number;
  sales: number;
  price: number;
  promo?: number; // 0 or 1
}

export interface LifespanStats {
  store_id: number;
  item_id: number;
  all_time_sales_total: number;
  total_days_active: number;
  all_time_sales_avg: number;
}

export interface DailyPrediction {
  prediction_date: string; // YYYY-MM-DD
  store_id: number;
  item_id: number;
  predicted_demand: number;
  rop: number;
  eoq: number;
  created_at: string;
}

export type SupplierChannel = "whatsapp" | "email" | "phone";

export interface Supplier {
  supplier_id: number;
  store_id?: number;
  item_id?: number;
  name: string;
  phone?: string;
  email?: string;
  pref: SupplierChannel;
}

export interface OrgConfiguration {
  org_id: number;
  batch_x: number;
  max_negotiation_turns: number;
}

// ============================================================
// Agent Negotiations & Turns
// ============================================================

export type NegotiationStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "aborted"
  | "completed";

export type NegotiationTriggerType = "might_be_low" | "immediately_low";

export type ResolutionType =
  | "transfer"
  | "even_split"
  | "supplier"
  | "cancelled";

export interface NegotiationTurn {
  turn_id: number;
  negotiation_id: number;
  store_id: number | null; // null = arbitrator
  turn_number: number;
  argument_text?: string;
  responded?: boolean;
  created_at: string;
}

export interface Negotiation {
  negotiation_id: number;
  org_id: number;
  item_id: number;
  initiating_store_id: number;
  trigger_type: NegotiationTriggerType;
  status: NegotiationStatus;
  resolution_type?: ResolutionType;
  created_at: string;
  updated_at: string;
  // Joined fields for frontend detail rendering
  item?: Item;
  initiating_store?: Store;
  turns?: NegotiationTurn[];
}

// ============================================================
// Stock Transfers
// ============================================================

export interface Transfer {
  transfer_id: number;
  negotiation_id: number;
  from_store_id: number;
  to_store_id: number;
  item_id: number;
  qty: number;
  from_confirmed: boolean;
  to_confirmed: boolean;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields for frontend detail rendering
  item?: Item;
  source_store?: Store;
  destination_store?: Store;
}

// ============================================================
// Supplier Contact (Case D / Escalation)
// ============================================================

export interface SupplierContactDraft {
  has_supplier: boolean;
  message?: string;
  channel?: "whatsapp" | "email";
  link?: string;
  instruction?: string;
}

// ============================================================
// Helper Status & Event Types
// ============================================================

export type InventoryTrigger = "immediately_low" | "might_be_low" | null;

export type ActivityEventType =
  | "negotiation_started"
  | "agent_responded"
  | "arbitrator_decision"
  | "transfer_proposed"
  | "transfer_approved"
  | "transfer_rejected"
  | "renegotiation_started"
  | "supplier_escalation"
  | "transfer_confirmation"
  | "transfer_completed"
  | "negotiation_failed"
  | "negotiation_aborted"
  | "negotiation_completed";

export interface ActivityEvent {
  event_id: number;
  event_type: ActivityEventType;
  negotiation_id?: number;
  description: string;
  created_at: string;
  store_id?: number;
  store?: Store;
}

export type NegotiationTurnOutcome = "responded" | "skipped" | "timed_out";

export type TransferPartyStatus = "confirmed" | "pending";

