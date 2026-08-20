"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { getActivity } from "@/lib/api/client";
import { activityEventVariant, formatRelativeTime } from "@/lib/formatting";
import { ActivitySkeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ActivityEvent, ActivityEventType } from "@/types";

function ActivityDot({ type }: { type: ActivityEventType }) {
  const variant = activityEventVariant(type);
  const colorMap: Record<string, string> = {
    critical: "bg-red-500",
    warning: "bg-amber-500",
    success: "bg-emerald-500",
    accent: "bg-indigo-500",
    neutral: "bg-zinc-400",
    default: "bg-zinc-300",
  };
  return (
    <span
      className={cn(
        "size-2 rounded-full shrink-0 mt-1.5",
        colorMap[variant] ?? colorMap.default,
      )}
    />
  );
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  const isLinked = event.negotiation_id != null;
  const content = (
    <div className="p-3 border border-zinc-150 rounded bg-white hover:bg-zinc-50 transition-all duration-100 flex gap-2.5 items-start cursor-pointer group shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
      <ActivityDot type={event.event_type} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-zinc-900 font-500 leading-snug">
          {event.description}
        </p>
        <div className="flex items-center gap-2 mt-1.5 text-[9px] font-mono text-zinc-400">
          <span>{formatRelativeTime(event.created_at)}</span>
          {event.store && (
            <>
              <span>·</span>
              <span className="uppercase">{event.store.location_name.split(" — ")[1] ?? event.store.location_name}</span>
            </>
          )}
        </div>
      </div>
      {isLinked && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="shrink-0 text-zinc-400 group-hover:text-zinc-900 transition-colors mt-0.5"
        >
          <path d="M7 17L17 7M7 7h10v10" />
        </svg>
      )}
    </div>
  );

  if (isLinked) {
    return (
      <Link href={`/negotiations/${event.negotiation_id}`} className="block">{content}</Link>
    );
  }
  return content;
}

export function ActivityRail() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: ["activity"],
    queryFn: () => getActivity(30),
    refetchInterval: 15000,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["activity"] });
      await refetch();
      toast.success("Timeline synchronized.");
    } catch {
      toast.error("Could not refresh timeline.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <aside className="hidden xl:flex flex-col w-[320px] shrink-0 bg-white border-l border-zinc-200 h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-150 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          <p className="text-[10px] font-800 uppercase tracking-widest text-[#000000]">
            System Timeline
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh activity"
          className={cn(
            "text-zinc-400 hover:text-zinc-950 transition-colors disabled:opacity-50",
            isRefreshing && "animate-spin"
          )}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Timeline Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f8f9fa]">
        {isLoading && <ActivitySkeleton />}
        {error && (
          <div className="p-4 text-xs text-zinc-400 text-center">
            Unable to stream activity events.
          </div>
        )}
        {events && events.length === 0 && (
          <div className="p-6 text-center text-xs text-zinc-450 italic">
            Timeline is empty.
          </div>
        )}
        {events && events.map((event) => (
          <ActivityItem key={event.event_id} event={event} />
        ))}
      </div>
    </aside>
  );
}
