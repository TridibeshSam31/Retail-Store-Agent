/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ActivityRail } from "./ActivityRail";
import { DemoBanner } from "@/components/ui/badges";
import { useAppStore } from "@/lib/store";

const IS_DEMO = !(process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL);

interface AppShellProps {
  children: React.ReactNode;
  showActivity?: boolean;
}

export function AppShell({ children, showActivity = true }: AppShellProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const setSession = useAppStore((state) => state.setSession);

  useEffect(() => {
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
      setIsAuthorized(true);
    }
  }, [router, setSession]);

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
        {/* Demo banner */}
        {IS_DEMO && <DemoBanner />}

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
