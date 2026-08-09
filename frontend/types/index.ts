// ============================================================
// Core entity types — derived from ml-part.sql schema
// and project documentation
// ============================================================

export interface Store {
  store_id: number;
  location_name: string;
}

export interface Item {
  item_id: number;
  item_name: string;
  category: string;
}

export interface InventoryMetadata {
  store_id: number;
  item_id: number;
  order_cost: number;
  annual_holding_cost: number;
  lead_time_days: number;
}

export interface RawTransaction {
  transaction_id: number;
  date: string;
  store_id: number;
  item_id: number;
  sales: number;
  price: number;
  promo: 0 | 1;
}

export interface DailyPrediction {
  prediction_date: string;
  store_id: number;
  item_id: number;
  predicted_demand: number;
  rop: number; // reorder point
  eoq: number; // economic order quantity
  created_at: string;
}

// ============================================================
// Inventory — current stock state
// ============================================================

export type InventoryTrigger = "might_be_low" | "immediately_low" | null;

export interface CurrentInventory {
  id: number;
  store_id: number;
  item_id: number;
  current_quantity: number;
  unit: string;
  trigger: InventoryTrigger;
  updated_at: string;
  // Joined fields
  store?: Store;
  item?: Item;
  prediction?: DailyPrediction;
}

export interface InventoryBatch {
  batch_id: number;
  store_id: number;
  item_id: number;
  quantity: number;
  expiry_date: string;
  unit: string;
}

// ============================================================
// Supplier
// ============================================================

export type SupplierChannel = "whatsapp" | "email" | "phone";

export interface Supplier {
  supplier_id: number;
  name: string;
  phone?: string;
  email?: string;
  preferred_channel: SupplierChannel;
  item_id?: number;
  store_id?: number;
}

// ============================================================
// Negotiation
// ============================================================

export type NegotiationStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "aborted"
  | "completed";

export type NegotiationTrigger = "might_be_low" | "immediately_low";

export type ResolutionType =
  | "transfer"
  | "even_split"
  | "supplier"
  | "cancelled";

export type NegotiationTurnRole = "store_agent" | "arbitrator";
export type NegotiationTurnOutcome = "responded" | "skipped" | "timed_out";

export interface NegotiationTurn {
  turn_id: number;
  negotiation_id: number;
  turn_number: number;
  speaker_store_id: number | null; // null = arbitrator
  role: NegotiationTurnRole;
  argument: string;
  outcome: NegotiationTurnOutcome;
  created_at: string;
  // Joined
  speaker_store?: Store;
}

export interface TransferAllocation {
  store_id: number;
  quantity: number;
  unit: string;
  store?: Store;
}

export interface NegotiationResolution {
  resolution_type: ResolutionType;
  source_store_id?: number;
  destination_store_id?: number;
  quantity?: number;
  unit?: string;
  allocations?: TransferAllocation[]; // for even_split
  unallocated_remainder?: number;
  is_max_turn_fallback?: boolean;
  source_store?: Store;
  destination_store?: Store;
}

export interface NegotiationContext {
  current_stock: number;
  unit: string;
  predicted_demand?: number;
  usable_surplus?: number;
  time_to_stockout_days?: number;
  transfer_time_hours?: number;
  participating_store_ids: number[];
  participating_stores?: Store[];
}

export interface Negotiation {
  negotiation_id: number;
  org_id?: number;
  item_id: number;
  initiating_store_id: number;
  trigger: NegotiationTrigger;
  status: NegotiationStatus;
  resolution?: NegotiationResolution;
  context?: NegotiationContext;
  turns?: NegotiationTurn[];
  is_infrastructure_failure?: boolean;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined
  item?: Item;
  initiating_store?: Store;
}

// ============================================================
// Transfer
// ============================================================

export type TransferPartyStatus = "pending" | "confirmed";

export interface TransferParty {
  store_id: number;
  status: TransferPartyStatus;
  confirmed_at?: string;
  store?: Store;
}

export interface Transfer {
  transfer_id: number;
  negotiation_id: number;
  item_id: number;
  quantity: number;
  unit: string;
  source_store_id: number;
  destination_store_id: number;
  parties: TransferParty[];
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  item?: Item;
  source_store?: Store;
  destination_store?: Store;
  negotiation?: Negotiation;
}

// ============================================================
// Supplier draft / escalation
// ============================================================

export interface SupplierDraft {
  supplier_id: number;
  supplier?: Supplier;
  item_id: number;
  item?: Item;
  store_id: number;
  store?: Store;
  quantity: number;
  unit: string;
  draft_message: string;
  deep_link?: string; // whatsapp:// or mailto:
}

// ============================================================
// Activity feed
// ============================================================

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
  transfer_id?: number;
  store_id?: number;
  item_id?: number;
  description: string;
  created_at: string;
  // Joined
  store?: Store;
  item?: Item;
}

// ============================================================
// Configuration
// ============================================================

export interface OrgConfiguration {
  org_id: number;
  batch_threshold: number;
  max_negotiation_turns: number;
  distance_tiers?: DistanceTier[];
}

export interface DistanceTier {
  tier_name: string;
  max_distance_km: number;
  transfer_hours: number;
}

// ============================================================
// Expiry alert
// ============================================================

export interface ExpiryAlert {
  batch_id: number;
  store_id: number;
  item_id: number;
  quantity: number;
  unit: string;
  expiry_date: string;
  days_until_expiry: number;
  store?: Store;
  item?: Item;
}

// ============================================================
// Auth / session
// ============================================================

export interface UserSession {
  user_id: number;
  name: string;
  email: string;
  store_id: number;
  org_id: number;
  role: "manager" | "viewer";
  store?: Store;
}

// ============================================================
// API response wrappers
// ============================================================

export interface ApiListResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code: string;
  status: number;
}
