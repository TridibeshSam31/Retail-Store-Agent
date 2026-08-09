"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ActivityRail } from "./ActivityRail";
import { DemoBanner } from "@/components/ui/badges";

const IS_DEMO = !process.env.NEXT_PUBLIC_API_BASE_URL;

interface AppShellProps {
  children: React.ReactNode;
  showActivity?: boolean;
}

export function AppShell({ children, showActivity = true }: AppShellProps) {
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
          <main className="flex-1 overflow-y-auto p-5 md:p-6">
            {children}
          </main>

          {/* Activity rail */}
          {showActivity && <ActivityRail />}
        </div>
      </div>
    </div>
  );
}
