import type {
  NegotiationStatus,
  InventoryTrigger,
  ActivityEventType,
  ResolutionType,
  NegotiationTurnOutcome,
  TransferPartyStatus,
} from "@/types";

// ─── Date/Time (Formatted in Indian Standard Time IST - Asia/Kolkata) ────

const IST_TIMEZONE = "Asia/Kolkata";

function parseDate(iso?: string | null): Date | null {
  if (!iso) return null;
  // If backend timestamp has no timezone offset (e.g. "2026-08-20T14:00:00"), treat it as UTC
  let str = iso.trim();
  if (str && !str.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str += "Z";
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso?: string | null): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso?: string | null): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleTimeString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateTime(iso?: string | null): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatRelativeTime(iso?: string | null): string {
  const d = parseDate(iso);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

// ─── Status labels ────────────────────────────────────────────

export function negotiationStatusLabel(status: NegotiationStatus): string {
  const labels: Record<NegotiationStatus, string> = {
    proposed: "In Progress",
    approved: "Approved",
    rejected: "Rejected",
    aborted: "Aborted",
    completed: "Completed",
  };
  return labels[status] ?? status;
}

export function triggerLabel(trigger: InventoryTrigger): string {
  if (!trigger) return "Normal";
  const labels: Record<NonNullable<InventoryTrigger>, string> = {
    might_be_low: "Might Be Low",
    immediately_low: "Critically Low",
  };
  return labels[trigger];
}

export function getInventoryTrigger(item?: { qty_on_hand: number; prediction?: { rop: number } | null } | null): InventoryTrigger {
  if (!item || !item.prediction || typeof item.prediction.rop !== "number") {
    return null;
  }
  const rop = item.prediction.rop;
  const qty = item.qty_on_hand;

  if (qty <=  Math.ceil(rop * 0.2)) {
    return "immediately_low";
  }
  if (qty <= rop) {
    return "might_be_low";
  }
  return null;
}

export function resolutionLabel(type: ResolutionType): string {
  const labels: Record<ResolutionType, string> = {
    transfer: "Transfer",
    even_split: "Even Split",
    partial: "Partial Split",
    supplier: "Supplier",
    cancelled: "Cancelled",
  };
  return labels[type];
}

export function activityEventLabel(type: ActivityEventType): string {
  const labels: Record<ActivityEventType, string> = {
    negotiation_started: "Negotiation Started",
    agent_responded: "Agent Responded",
    arbitrator_decision: "Arbitrator Decision",
    transfer_proposed: "Transfer Proposed",
    transfer_approved: "Transfer Approved",
    transfer_rejected: "Transfer Rejected",
    renegotiation_started: "Renegotiation Started",
    supplier_escalation: "Supplier Escalation",
    transfer_confirmation: "Transfer Confirmed",
    transfer_completed: "Transfer Completed",
    negotiation_failed: "Negotiation Failed",
    negotiation_aborted: "Negotiation Aborted",
    negotiation_completed: "Negotiation Completed",
  };
  return labels[type] ?? type;
}

export function turnOutcomeLabel(outcome: NegotiationTurnOutcome): string {
  const labels: Record<NegotiationTurnOutcome, string> = {
    responded: "Responded",
    skipped: "Skipped",
    timed_out: "Timed Out",
  };
  return labels[outcome];
}

export function partyStatusLabel(status: TransferPartyStatus): string {
  return status === "confirmed" ? "Confirmed" : "Pending";
}

// ─── Colors (CSS variable values for inline use) ──────────────

export type StatusVariant =
  | "critical"
  | "warning"
  | "success"
  | "neutral"
  | "accent"
  | "default";

export function negotiationStatusVariant(status: NegotiationStatus): StatusVariant {
  const map: Record<NegotiationStatus, StatusVariant> = {
    proposed: "accent",
    approved: "success",
    rejected: "critical",
    aborted: "neutral",
    completed: "success",
  };
  return map[status] ?? "default";
}

export function triggerVariant(trigger: InventoryTrigger): StatusVariant {
  if (!trigger) return "default";
  return trigger === "immediately_low" ? "critical" : "warning";
}

export function activityEventVariant(type: ActivityEventType): StatusVariant {
  const map: Partial<Record<ActivityEventType, StatusVariant>> = {
    negotiation_failed: "critical",
    negotiation_aborted: "neutral",
    transfer_rejected: "critical",
    transfer_approved: "success",
    transfer_completed: "success",
    negotiation_completed: "success",
    arbitrator_decision: "accent",
    supplier_escalation: "warning",
  };
  return map[type] ?? "default";
}

// ─── Number formatting ────────────────────────────────────────

export function formatQuantity(qty: number, unit: string): string {
  return `${qty.toLocaleString("en-IN")} ${unit}`;
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─── Expiry urgency ───────────────────────────────────────────

export function expiryUrgencyVariant(daysUntilExpiry: number): StatusVariant {
  if (daysUntilExpiry <= 1) return "critical";
  if (daysUntilExpiry <= 3) return "warning";
  return "neutral";
}

export function expiryLabel(daysUntilExpiry: number): string {
  if (daysUntilExpiry <= 0) return "Expired";
  if (daysUntilExpiry === 1) return "Expires tomorrow";
  return `Expires in ${daysUntilExpiry} days`;
}
