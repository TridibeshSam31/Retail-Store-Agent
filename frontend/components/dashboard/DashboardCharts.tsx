"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface InventoryRiskChartProps {
  critical: number;
  warning: number;
  healthy: number;
}

export function InventoryRiskChart({ critical, warning, healthy }: InventoryRiskChartProps) {
  const total = critical + warning + healthy;
  const criticalPct = total > 0 ? (critical / total) * 100 : 0;
  const warningPct = total > 0 ? (warning / total) * 100 : 0;
  const healthyPct = total > 0 ? (healthy / total) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[10px] font-mono font-700 uppercase text-zinc-400">Inventory Health Breakdown</span>
        <span className="text-[10px] font-mono text-zinc-500">{total} catalog items monitored</span>
      </div>

      {/* Progress Bar Gauge */}
      <div className="h-3 w-full rounded-full bg-zinc-150 overflow-hidden flex">
        {healthyPct > 0 && (
          <div
            style={{ width: `${healthyPct}%` }}
            className="bg-emerald-500 h-full transition-all duration-500"
            title={`Healthy: ${healthy}`}
          />
        )}
        {warningPct > 0 && (
          <div
            style={{ width: `${warningPct}%` }}
            className="bg-amber-500 h-full transition-all duration-500"
            title={`At Risk: ${warning}`}
          />
        )}
        {criticalPct > 0 && (
          <div
            style={{ width: `${criticalPct}%` }}
            className="bg-red-500 h-full transition-all duration-500"
            title={`Critical: ${critical}`}
          />
        )}
      </div>

      {/* Legend & Stats */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-mono font-700 text-emerald-700 uppercase">Healthy</p>
            <p className="text-xs font-mono font-800 text-emerald-950">{healthy} <span className="text-[9px] text-emerald-600">({Math.round(healthyPct)}%)</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/50 border border-amber-100">
          <span className="size-2 rounded-full bg-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-mono font-700 text-amber-700 uppercase">Forecast Risk</p>
            <p className="text-xs font-mono font-800 text-amber-950">{warning} <span className="text-[9px] text-amber-600">({Math.round(warningPct)}%)</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100">
          <span className="size-2 rounded-full bg-red-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-mono font-700 text-red-700 uppercase">Critical</p>
            <p className="text-xs font-mono font-800 text-red-950">{critical} <span className="text-[9px] text-red-600">({Math.round(criticalPct)}%)</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ExpiryTimelineChartProps {
  expiries: { days_until_expiry?: number }[];
}

export function ExpiryTimelineChart({ expiries }: ExpiryTimelineChartProps) {
  const buckets = [
    { label: "1-2 Days", count: expiries.filter(e => (e.days_until_expiry ?? 99) <= 2).length, color: "bg-red-500", barColor: "bg-red-400", border: "border-red-200" },
    { label: "3-5 Days", count: expiries.filter(e => (e.days_until_expiry ?? 99) > 2 && (e.days_until_expiry ?? 99) <= 5).length, color: "bg-amber-500", barColor: "bg-amber-400", border: "border-amber-200" },
    { label: "6-7 Days", count: expiries.filter(e => (e.days_until_expiry ?? 99) > 5 && (e.days_until_expiry ?? 99) <= 7).length, color: "bg-blue-500", barColor: "bg-blue-400", border: "border-blue-200" },
    { label: "> 7 Days", count: expiries.filter(e => (e.days_until_expiry ?? 99) > 7).length, color: "bg-zinc-400", barColor: "bg-zinc-300", border: "border-zinc-200" },
  ];

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[10px] font-mono font-700 uppercase text-zinc-400">Batch Expiry Window</span>
        <span className="text-[10px] font-mono text-zinc-500">{expiries.length} active batches</span>
      </div>

      <div className="grid grid-cols-4 gap-2 h-24 items-end pt-2">
        {buckets.map((b) => {
          const heightPct = Math.max((b.count / maxCount) * 100, 10);
          return (
            <div key={b.label} className="flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] font-mono font-700 text-zinc-700">{b.count}</span>
              <div className="w-full bg-zinc-100 rounded-t-sm h-14 flex items-end overflow-hidden">
                <div
                  style={{ height: `${heightPct}%` }}
                  className={cn("w-full rounded-t-sm transition-all duration-500", b.barColor)}
                />
              </div>
              <span className="text-[9px] font-mono text-zinc-400 whitespace-nowrap">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
