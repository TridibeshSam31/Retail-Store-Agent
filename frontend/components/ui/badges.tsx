import { cn } from "@/lib/utils";
import type { StatusVariant } from "@/lib/formatting";

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<StatusVariant, string> = {
  critical: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  neutral: "bg-zinc-50 text-zinc-600 border-zinc-200",
  accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  default: "bg-zinc-50 text-zinc-500 border-zinc-200",
};

const dotColors: Record<StatusVariant, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  neutral: "bg-zinc-400",
  accent: "bg-indigo-500",
  default: "bg-zinc-400",
};

export function StatusBadge({
  variant = "default",
  children,
  className,
  dot = false,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-700 uppercase tracking-tight rounded-sm border whitespace-nowrap",
        variantClasses[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1 rounded-full shrink-0",
            dotColors[variant],
            variant === "accent" && "animate-pulse-dot",
          )}
        />
      )}
      {children}
    </span>
  );
}

interface RiskBadgeProps {
  trigger: "might_be_low" | "immediately_low" | null;
  className?: string;
}

export function RiskBadge({ trigger, className }: RiskBadgeProps) {
  if (!trigger) {
    return (
      <StatusBadge variant="neutral" className={className}>
        Stock OK
      </StatusBadge>
    );
  }

  if (trigger === "immediately_low") {
    return (
      <StatusBadge variant="critical" dot className={className}>
        Immediate Alert
      </StatusBadge>
    );
  }

  return (
    <StatusBadge variant="warning" dot className={className}>
      Forecast Risk
    </StatusBadge>
  );
}

interface StoreBadgeProps {
  storeId: number;
  storeName?: string;
  className?: string;
  size?: "sm" | "md";
}

const storeColors = [
  "bg-zinc-100 text-zinc-800 border-zinc-200",
  "bg-zinc-100 text-zinc-800 border-zinc-200",
  "bg-zinc-100 text-zinc-800 border-zinc-200",
  "bg-zinc-100 text-zinc-800 border-zinc-200",
];

export function StoreBadge({
  storeId,
  storeName,
  className,
  size = "md",
}: StoreBadgeProps) {
  const colorClass = storeColors[(storeId - 1) % storeColors.length];
  const shortName = storeName
    ? storeName.split(" — ")[1] || storeName
    : `Store ${storeId}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border font-mono font-700 uppercase tracking-tight whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]",
        colorClass,
        className,
      )}
    >
      <span className="size-1 rounded-full bg-zinc-400 shrink-0" />
      {shortName}
    </span>
  );
}
