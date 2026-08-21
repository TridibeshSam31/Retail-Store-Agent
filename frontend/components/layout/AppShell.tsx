"use client";

import React, { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ActivityRail } from "./ActivityRail";
import { useAppStore } from "@/lib/store";

const HAS_API_URL = Boolean(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL);

interface AppShellProps {
  children: React.ReactNode;
  showActivity?: boolean;
}

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getAuthSnapshot() {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("org_id") && localStorage.getItem("store_id"));
}

function getServerSnapshot() {
  return false;
}

export function AppShell({ children, showActivity = true }: AppShellProps) {
  const router = useRouter();
  const isAuthorized = useSyncExternalStore(subscribeToStorage, getAuthSnapshot, getServerSnapshot);
  const setSession = useAppStore((state) => state.setSession);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const orgId = localStorage.getItem("org_id");
    const storeId = localStorage.getItem("store_id");
    const locationName = localStorage.getItem("location_name") || `Store ${storeId}`;
    if (!orgId || !storeId) {
      router.push("/");
    } else {
      setSession({
        org_id: Number(orgId),
        store_id: Number(storeId),
        location_name: locationName,
        expiry_alerts: [],
      });
    }
  }, [router, setSession]);

  if (!HAS_API_URL) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="max-w-md bg-zinc-900 border border-red-500/30 rounded-xl p-6 text-white space-y-4 shadow-2xl">
          <div className="size-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400 font-mono font-700 text-lg">
            !
          </div>
          <h2 className="text-base font-600 text-red-400">Configuration Error</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            <code className="text-red-300 font-mono">NEXT_PUBLIC_API_URL</code> environment variable is missing. Live backend API connection is required.
          </p>
          <p className="text-[11px] text-zinc-500">
            Please set <code className="text-zinc-300 font-mono">NEXT_PUBLIC_API_URL</code> in your deployment environment or <code className="text-zinc-300 font-mono">.env.local</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
        Initializing terminal session...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <Topbar />

        {/* Content + Activity */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-5 md:p-6 animate-fade-in">
            {children}
          </main>

          {/* Activity rail */}
          {showActivity && <ActivityRail />}
        </div>
      </div>
    </div>
  );
}
