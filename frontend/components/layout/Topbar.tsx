"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/": "OPERATIONAL RUNTIME",
  "/inventory": "INVENTORY INVENTORY",
  "/predictions": "DEMAND PREDICTIONS",
  "/negotiations": "AGENT NEGOTIATIONS",
  "/transfers": "STOCK SHIPMENTS",
  "/expiry": "BATCH SHELF-LIFE",
  "/suppliers": "SUPPLIER DIRECTORY",
  "/configuration": "RUNTIME SETTINGS",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/negotiations/")) return "NEGOTIATION LOGS";
  if (pathname.startsWith("/inventory/")) return "STOCK METRICS";
  return "OPERATIONS CENTER";
}

interface TopbarProps {
  className?: string;
}

export function Topbar({ className }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header
      className={cn(
        "h-16 shrink-0 bg-[#ffffff] border-b border-zinc-150 flex items-center px-6 gap-4 select-none",
        className,
      )}
    >
      {/* Dynamic Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xs font-900 uppercase tracking-widest text-[#000000]">{title}</h1>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {/* Store Context Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-50 border border-zinc-200 rounded text-[10px] font-mono font-700 text-zinc-800 uppercase">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          Store 1 / KRM
        </div>

        {/* Vertical Separator */}
        <span className="h-4 w-px bg-zinc-200 hidden sm:inline" />

        {/* User initials */}
        <div className="size-8 rounded-full bg-zinc-900 border border-zinc-950 text-white text-[11px] font-800 flex items-center justify-center">
          AM
        </div>
      </div>
    </header>
  );
}
