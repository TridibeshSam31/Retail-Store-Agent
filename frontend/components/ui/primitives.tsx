import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0 bg-white">
      {/* Header */}
      <div
        className="grid gap-4 px-5 py-4 border-b border-zinc-150 bg-zinc-50"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="grid gap-4 px-5 py-4 border-b border-zinc-100"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={cn(
                "h-4.5",
                colIdx === 0 ? "w-28" : colIdx === cols - 1 ? "w-12" : "w-20",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("premium-card p-5 space-y-4", className)}>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

export function NegotiationSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="premium-card p-6 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid grid-cols-4 gap-4 pt-3 border-t border-zinc-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4.5 w-12" />
            </div>
          ))}
        </div>
      </div>
      {/* Turns */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="size-8 rounded-full shrink-0" />
          <div className="flex-1 premium-card p-5 space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="premium-card p-3 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center premium-card bg-zinc-50/50 border-dashed",
        className,
      )}
    >
      {icon && (
        <div className="size-10 rounded bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 mb-4">
          {icon}
        </div>
      )}
      <p className="text-xs font-800 text-zinc-900 uppercase tracking-wider">{title}</p>
      {description && (
        <p className="text-xs text-zinc-400 mt-1.5 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "DATA RUNTIME ERROR",
  message = "Operation failed. The retail service could not return database metrics.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center premium-card border-red-200 bg-red-50/10",
        className,
      )}
    >
      <div className="size-10 rounded bg-red-50 border border-red-200 flex items-center justify-center text-red-500 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <p className="text-xs font-900 text-red-700 uppercase tracking-widest">{title}</p>
      <p className="text-xs text-zinc-500 mt-1.5 max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-3.5 py-1.5 text-[11px] font-700 font-mono uppercase tracking-wider rounded border border-zinc-300 bg-white hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          Retry request
        </button>
      )}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

const btnVariant = {
  primary: "bg-[#000000] text-white hover:bg-zinc-800 border border-[#000000] uppercase font-700 tracking-wider text-[10px] rounded-sm",
  secondary: "bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200 uppercase font-700 tracking-wider text-[10px] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
  danger: "bg-red-650 text-white hover:bg-red-700 border border-red-650 uppercase font-700 tracking-wider text-[10px] rounded-sm",
  ghost: "bg-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 uppercase font-700 tracking-wider text-[10px] rounded-sm",
  outline: "bg-transparent text-indigo-650 hover:bg-indigo-50 border border-indigo-200 uppercase font-700 tracking-wider text-[10px] rounded-sm",
};

const btnSize = {
  sm: "px-2.5 py-1.5",
  md: "px-3.5 py-2",
  lg: "px-5 py-2.5",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-mono transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none",
        btnVariant[variant],
        btnSize[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin size-3 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
