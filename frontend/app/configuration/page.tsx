/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { getConfiguration, updateConfiguration } from "@/lib/api/client";
import { CardSkeleton, Button } from "@/components/ui/primitives";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function ConfigurationPage() {
  const queryClient = useQueryClient();
  const { data: config, isLoading, error } = useQuery({
    queryKey: ["configuration"],
    queryFn: () => getConfiguration(),
  });

  // State values for forms
  const [batchThreshold, setBatchThreshold] = useState(50);
  const [maxTurns, setMaxTurns] = useState(6);

  useEffect(() => {
    if (config) {
      setBatchThreshold(config.batch_threshold);
      setMaxTurns(config.max_negotiation_turns);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateConfiguration({
        batch_threshold: Number(batchThreshold),
        max_negotiation_turns: Number(maxTurns),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuration"] });
      toast.success("Operations configurations updated.");
    },
    onError: (err: unknown) => {
      toast.error((err as Error).message ?? "Failed to save configurations.");
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-700 text-zinc-950 uppercase tracking-tight">LOGISTICS & RUNTIME CONFIG</h1>
          <p className="text-xs text-zinc-500 mt-0.5 font-500">Configure logistics thresholds, agent negotiation turn limits, and regional transit velocity rules.</p>
        </div>

        {isLoading ? (
          <CardSkeleton />
        ) : error || !config ? (
          <div className="p-8 text-center text-red-500 bg-white border border-zinc-200 rounded-lg">
            Failed to load configurations.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main configurations card */}
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-6">
              <h2 className="text-xs font-700 uppercase tracking-wider text-zinc-950 border-b border-zinc-100 pb-3">
                Agent Decision Constraints
              </h2>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
                className="space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="block font-700 text-zinc-500 uppercase">Batch Volatility Threshold (%)</label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={100}
                      value={batchThreshold}
                      onChange={(e) => setBatchThreshold(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-800"
                    />
                    <p className="text-[10px] text-zinc-450 leading-relaxed">
                      Defines the percentage threshold for evaluating rolling stock volatility during forecast shortfall evaluations.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-700 text-zinc-500 uppercase">Max Agent Communication Turns</label>
                    <input
                      type="number"
                      required
                      min={2}
                      max={20}
                      value={maxTurns}
                      onChange={(e) => setMaxTurns(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-zinc-50 text-zinc-800"
                    />
                    <p className="text-[10px] text-zinc-450 leading-relaxed">
                      The maximum speaker turns allowed before the neutral arbitrator falls back to an Even Split allocation matrix.
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-100 flex justify-end">
                  <Button variant="primary" size="sm" type="submit" loading={saveMutation.isPending}>
                    Save Operations Configs
                  </Button>
                </div>
              </form>
            </div>

            {/* Distance tiers explanation card */}
            <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm space-y-4 text-xs">
              <h3 className="text-xs font-700 uppercase tracking-wider text-zinc-955">
                Distance Tier Transit Times
              </h3>
              <p className="text-zinc-500 leading-relaxed">
                These read-only values represent geographical distance transit periods used by sub-agents to verify route feasibility.
              </p>
              <div className="divide-y divide-zinc-100">
                {config.distance_tiers?.map((tier, i) => (
                  <div key={i} className="py-2.5 flex justify-between font-500">
                    <span className="text-zinc-400">{tier.tier_name} Tier (&lt; {tier.max_distance_km} km)</span>
                    <span className="font-600 text-zinc-800">{tier.transfer_hours} hrs Lead Time</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
