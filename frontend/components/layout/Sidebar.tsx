"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="size-4 shrink-0 flex items-center justify-center opacity-80">
      {children}
    </span>
  );
}

const icons = {
  overview: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  inventory: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  predictions: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  negotiations: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  transfers: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  ),
  expiry: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  suppliers: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  config: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [{ href: "/dashboard", label: "Overview", icon: <NavIcon>{icons.overview}</NavIcon> }],
  },
  {
    label: "Operations",
    items: [
      { href: "/inventory", label: "Inventory", icon: <NavIcon>{icons.inventory}</NavIcon> },
      { href: "/predictions", label: "Predictions", icon: <NavIcon>{icons.predictions}</NavIcon> },
      { href: "/negotiations", label: "Negotiations", icon: <NavIcon>{icons.negotiations}</NavIcon> },
      { href: "/transfers", label: "Transfers", icon: <NavIcon>{icons.transfers}</NavIcon> },
      { href: "/expiry", label: "Expiry Alerts", icon: <NavIcon>{icons.expiry}</NavIcon> },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/suppliers", label: "Suppliers", icon: <NavIcon>{icons.suppliers}</NavIcon> },
      { href: "/configuration", label: "Configuration", icon: <NavIcon>{icons.config}</NavIcon> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex flex-col w-[240px] shrink-0 bg-[#09090b] text-zinc-400 h-full overflow-y-auto select-none border-r border-zinc-900">
      {/* Branding Header */}
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="size-6 rounded bg-white flex items-center justify-center text-black font-900 text-xs">
          W
        </div>
        <div className="leading-tight">
          <p className="text-[12px] font-800 uppercase tracking-wider text-white">WareAgent</p>
          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">SaaS Console</p>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-4 py-2 space-y-6">
        {navGroups.map((group, gi) => (
          <div key={gi} className="space-y-1.5">
            {group.label && (
              <p className="px-3 text-[9px] font-800 uppercase tracking-widest text-zinc-600">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-xs font-600 tracking-tight transition-all duration-100 group",
                    isActive(item.href)
                      ? "bg-zinc-800/60 text-white font-700"
                      : "hover:text-white hover:bg-zinc-900/40",
                  )}
                >
                  <span
                    className={cn(
                      "transition-colors",
                      isActive(item.href) ? "text-white" : "text-zinc-500 group-hover:text-zinc-350",
                    )}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer User Info */}
      <div className="p-4 border-t border-zinc-900">
        <div className="flex items-center gap-3 p-2 rounded bg-zinc-900/30 border border-zinc-900/65">
          <div className="size-7 rounded bg-zinc-800 flex items-center justify-center text-white text-xs font-800">
            AM
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-xs font-700 text-white truncate">Arjun Mehta</p>
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider truncate">Store 1 Manager</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
