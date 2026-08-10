/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrgs, getStoresForPicker, selectIdentity } from "@/lib/api/client";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const pageTitles: Record<string, string> = {
  "/dashboard": "OPERATIONAL RUNTIME",
  "/inventory": "INVENTORY METRICS",
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const title = getPageTitle(pathname);
  const setSession = useAppStore((state) => state.setSession);

  const [currentOrgId, setCurrentOrgId] = useState<string>("");
  const [currentStoreId, setCurrentStoreId] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const org = localStorage.getItem("org_id") || "1";
      const store = localStorage.getItem("store_id") || "1";
      setCurrentOrgId(org);
      setCurrentStoreId(store);
    }
  }, []);

  // Fetch orgs for selector
  const { data: orgs } = useQuery({
    queryKey: ["identityOrgsTopbar"],
    queryFn: () => getOrgs(),
  });

  // Fetch stores for active org
  const { data: stores } = useQuery({
    queryKey: ["identityStoresTopbar", currentOrgId],
    queryFn: () => getStoresForPicker(Number(currentOrgId)),
    enabled: !!currentOrgId,
  });

  const handleOrgChange = async (newOrgId: string) => {
    setCurrentOrgId(newOrgId);
    setCurrentStoreId("");
    localStorage.setItem("org_id", newOrgId);
  };

  const handleStoreChange = async (newStoreId: string) => {
    if (!currentOrgId || !newStoreId) return;
    setCurrentStoreId(newStoreId);
    try {
      const sessionData = await selectIdentity(Number(currentOrgId), Number(newStoreId));
      localStorage.setItem("org_id", String(sessionData.org_id));
      localStorage.setItem("store_id", String(sessionData.store_id));
      localStorage.setItem("location_name", sessionData.location_name);
      setSession(sessionData);
      queryClient.invalidateQueries();
      toast.success(`Context updated: ${sessionData.location_name}`);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Could not update store context.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("org_id");
    localStorage.removeItem("store_id");
    localStorage.removeItem("location_name");
    router.push("/");
  };

  return (
    <header
      className={cn(
        "h-16 shrink-0 bg-white border-b border-zinc-200 flex items-center px-4 md:px-6 gap-3 select-none justify-between z-20",
        className,
      )}
    >
      {/* Brand logo & Page Title */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-black text-white flex items-center justify-center font-900 text-xs">
            D
          </div>
          <span className="font-900 tracking-tighter text-sm uppercase text-black hidden sm:inline">
            Dayos
          </span>
        </div>
        <span className="h-4 w-px bg-zinc-200 hidden sm:inline" />
        <h1 className="text-xs font-900 uppercase tracking-wider text-zinc-900 truncate">
          {title}
        </h1>
      </div>

      {/* Global Organization & Store Selector Bar */}
      <div className="flex items-center gap-2.5">
        {/* Organization Picker Dropdown */}
        <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1 text-xs">
          <span className="text-[9px] font-mono font-700 text-zinc-400 uppercase hidden md:inline">Org:</span>
          <select
            value={currentOrgId}
            onChange={(e) => handleOrgChange(e.target.value)}
            className="bg-transparent font-700 text-zinc-900 text-xs focus:outline-none cursor-pointer"
          >
            <option value="">-- Org --</option>
            {orgs?.map((org) => (
              <option key={org.org_id} value={org.org_id}>
                {org.org_name}
              </option>
            ))}
          </select>
        </div>

        {/* Store Node Picker Dropdown */}
        <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1 text-xs">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          <span className="text-[9px] font-mono font-700 text-zinc-400 uppercase hidden md:inline">Node:</span>
          <select
            value={currentStoreId}
            onChange={(e) => handleStoreChange(e.target.value)}
            className="bg-transparent font-700 text-zinc-900 text-xs focus:outline-none cursor-pointer max-w-[140px] md:max-w-[200px] truncate"
          >
            <option value="">-- Store Node --</option>
            {stores?.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.location_name}
              </option>
            ))}
          </select>
        </div>

        {/* Switch identity / Exit session button */}
        <button
          onClick={handleLogout}
          title="Switch Identity / Login"
          className="p-1.5 rounded border border-zinc-200 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
