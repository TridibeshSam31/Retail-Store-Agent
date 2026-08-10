"use client";

import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getOrgs, getStoresForPicker, selectIdentity } from "@/lib/api/client";
import { Button } from "@/components/ui/primitives";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import Link from "next/link";

export default function RebuiltDayosHomepage() {
  const router = useRouter();
  const setSession = useAppStore((state) => state.setSession);

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carousel scroll reference
  const carouselRef = useRef<HTMLDivElement>(null);

  // Fetch organizations
  const { data: orgs, isLoading: isLoadingOrgs } = useQuery({
    queryKey: ["identityOrgsLanding"],
    queryFn: () => getOrgs(),
  });

  // Fetch stores once organization is selected
  const { data: stores, isLoading: isLoadingStores } = useQuery({
    queryKey: ["identityStoresLanding", selectedOrgId],
    queryFn: () => getStoresForPicker(Number(selectedOrgId)),
    enabled: !!selectedOrgId,
  });

  const handleSelectIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !selectedStoreId) return;

    setIsSubmitting(true);
    try {
      const sessionData = await selectIdentity(Number(selectedOrgId), Number(selectedStoreId));

      localStorage.setItem("org_id", String(sessionData.org_id));
      localStorage.setItem("store_id", String(sessionData.store_id));
      localStorage.setItem("location_name", sessionData.location_name);

      setSession(sessionData);
      toast.success(`Identity established: ${sessionData.location_name}`);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Could not establish identity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToSelector = () => {
    document.getElementById("terminal-selector")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 340;
      carouselRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#ececec] text-zinc-900 font-sans selection:bg-[#a3e635] selection:text-black py-0 sm:py-6 px-0 sm:px-4">
      
      {/* ─── Centered Max-Width Brand Site Canvas ────────────────────────────────────────── */}
      <div className="max-w-[1150px] mx-auto bg-[#f5f5f3] shadow-2xl rounded-none sm:rounded-[32px] overflow-hidden border border-zinc-200 flex flex-col relative">
        
        {/* Floating background glowing mesh orb (lime-yellow accent in hero area) */}
        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-br from-lime-300/10 via-yellow-200/5 to-transparent blur-[120px] rounded-full pointer-events-none z-0" />

        {/* ─── Navigation Header ────────────────────────────────────────── */}
        <header className="px-6 py-5 md:px-10 flex items-center justify-between bg-[#f5f5f3] z-30 border-b border-zinc-200/40">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded bg-black text-white flex items-center justify-center font-mono font-900 text-xs shadow-sm">
              N
            </div>
            <span className="font-header font-700 tracking-wider text-xl uppercase text-black">
              NODE
            </span>
          </div>

          {/* Navigation Links Capsule */}
          <nav className="hidden md:flex items-center gap-1 bg-white border border-zinc-200/80 px-4 py-1.5 rounded-full text-[11px] font-700 text-zinc-550 shadow-sm uppercase tracking-wide">
            <a href="#platform" className="px-3.5 py-1 hover:text-black transition-colors">Platform</a>
            <a href="#how-it-works" className="px-3.5 py-1 hover:text-black transition-colors">How It Works</a>
            <a href="#store-network" className="px-3.5 py-1 hover:text-black transition-colors">Store Network</a>
            <a href="#use-cases" className="px-3.5 py-1 hover:text-black transition-colors">Use Cases</a>
          </nav>

          <button
            onClick={scrollToSelector}
            className="bg-black text-white px-5 py-2.5 rounded-full font-700 text-[10px] hover:bg-zinc-800 transition-colors uppercase tracking-widest shadow-sm font-mono hover:scale-105 active:scale-95"
          >
            Open Platform
          </button>
        </header>

        {/* ─── Hero Section (Flush background, no separate rounded cards) ────────────────────── */}
        <section id="platform" className="px-6 md:px-12 pt-16 pb-24 bg-[#f5f5f3] relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Hero Text Left */}
            <div className="lg:col-span-7 space-y-6">
              <h1 className="text-4xl sm:text-6xl lg:text-7.5xl font-header font-700 tracking-tight leading-[0.88] text-black uppercase">
                YOUR STORES<br />
                DON&apos;T HAVE TO<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-amber-500 font-extrabold">SOLVE SHORTAGES</span><br />
                ALONE.
              </h1>
              
              <div className="space-y-3">
                <p className="text-sm md:text-base text-zinc-700 font-500 max-w-[500px] leading-relaxed">
                  AI agents monitor inventory, negotiate across your store network, and recommend the best next move before a shortage becomes a problem.
                </p>
                <p className="text-xs text-zinc-450 font-500 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#a3e635] animate-ping" />
                  You stay in control. The agents handle the coordination.
                </p>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={scrollToSelector}
                  className="bg-black text-white px-6 py-3 rounded-full font-700 text-xs hover:bg-zinc-800 transition-all uppercase tracking-wider shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  Explore the Platform
                </button>
                <a
                  href="#how-it-works"
                  className="group inline-flex items-center gap-1.5 text-xs font-700 text-black hover:text-[#a3e635] transition-colors uppercase tracking-wider font-mono"
                >
                  See How It Works <span className="group-hover:translate-x-1 transition-transform">→</span>
                </a>
              </div>
            </div>

            {/* Hero Right Visual: Connected Store Nodes & Arbitrator */}
            <div className="lg:col-span-5 flex justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-lime-350/20 to-yellow-350/10 blur-3xl rounded-full" />
              
              <div className="relative size-64 sm:size-80 bg-zinc-900 rounded-3xl border border-zinc-800 flex items-center justify-center overflow-hidden shadow-2xl">
                <svg className="w-full h-full p-6" viewBox="0 0 200 200" fill="none">
                  {/* Central connections */}
                  <line x1="40" y1="140" x2="100" y2="40" stroke="#facc15" strokeWidth="1.5" strokeDasharray="3 3" />
                  <line x1="160" y1="140" x2="100" y2="40" stroke="#a3e635" strokeWidth="1.5" strokeDasharray="3 3" />
                  <line x1="40" y1="140" x2="160" y2="140" stroke="#555" strokeWidth="1.5" />
                  
                  {/* Store 1 Node */}
                  <g className="animate-bounce" style={{ animationDuration: "4s" }}>
                    <rect x="25" y="125" width="30" height="30" rx="6" fill="#000000" stroke="#a3e635" strokeWidth="1.5" />
                    <circle cx="40" cy="140" r="3" fill="#a3e635" className="animate-ping" />
                    <text x="40" y="118" textAnchor="middle" fill="#a3e635" fontSize="7" fontWeight="bold" fontFamily="monospace">STORE 1</text>
                  </g>
                  
                  {/* Store 2 Node */}
                  <g className="animate-bounce" style={{ animationDuration: "5s", animationDelay: "1s" }}>
                    <rect x="85" y="25" width="30" height="30" rx="6" fill="#a3e635" stroke="#facc15" strokeWidth="1.5" />
                    <circle cx="100" cy="40" r="3.5" fill="#000000" />
                    <text x="100" y="18" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="monospace">STORE 2</text>
                  </g>

                  {/* Store 3 Node */}
                  <g className="animate-bounce" style={{ animationDuration: "6s", animationDelay: "2s" }}>
                    <rect x="145" y="125" width="30" height="30" rx="6" fill="#000000" stroke="#facc15" strokeWidth="1.5" />
                    <circle cx="160" cy="140" r="3" fill="#facc15" />
                    <text x="160" y="118" textAnchor="middle" fill="#facc15" fontSize="7" fontWeight="bold" fontFamily="monospace">STORE 3</text>
                  </g>
                  
                  {/* Arbitrator Node */}
                  <circle cx="100" cy="115" r="16" fill="#ffffff" stroke="#a3e635" strokeWidth="2" />
                  <text x="100" y="118" textAnchor="middle" fill="#000" fontSize="9" fontWeight="900" fontFamily="monospace">A</text>
                </svg>
              </div>
            </div>

          </div>
        </section>

        {/* ─── First Black Section (Flush Edge-to-Edge Container, Rounded Top Edge) ─────────── */}
        <section id="how-it-works" className="bg-[#000000] text-white px-6 md:px-12 py-24 sm:py-32 rounded-t-[36px] relative overflow-hidden z-10">
          
          {/* Neon mesh glows inside black section */}
          <div className="absolute top-[20%] left-[-100px] w-96 h-96 bg-lime-500/10 blur-[130px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[20%] right-[-100px] w-96 h-96 bg-yellow-500/10 blur-[130px] rounded-full pointer-events-none" />

          {/* Detect / Negotiate / Resolve Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-b border-zinc-800 pb-20 relative z-10">
            <div className="space-y-3.5">
              <h2 className="text-3xl font-header font-700 tracking-tight text-[#a3e635] uppercase">DETECT.</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Prediction algorithms and real-time inventory checks identify stockout risks before they become customer problems.
              </p>
            </div>
            <div className="space-y-3.5">
              <h2 className="text-3xl font-header font-700 tracking-tight text-white uppercase">NEGOTIATE.</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Store agents represent their own inventory needs, coordinating over surplus stock across the store network autonomously.
              </p>
            </div>
            <div className="space-y-3.5">
              <h2 className="text-3xl font-header font-700 tracking-tight text-[#facc15] uppercase">RESOLVE.</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A neutral arbitrator determines final allocations when multiple nodes contest stock, outputting ready-to-approve recommendations.
              </p>
            </div>
          </div>

          {/* Large Editorial Statement */}
          <div className="max-w-3xl space-y-6 pt-16 relative z-10">
            <h2 className="text-4xl sm:text-6xl font-header font-700 tracking-tight leading-[0.92] uppercase text-white">
              STOP WATCHING<br />
              INVENTORY.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-yellow-300 to-amber-400">START SOLVING IT.</span>
            </h2>
            <div className="space-y-4 text-sm text-zinc-400 max-w-xl leading-relaxed">
              <p>Traditional inventory software tells you what&apos;s running low.</p>
              <p className="text-white font-600">
                Our system goes further. It detects the shortage, checks the network, lets store agents negotiate over available stock, and produces a decision ready for human approval.
              </p>
            </div>
          </div>

          {/* ─── Product Screenshot & Interactive Gateway Terminal Card ─── */}
          <div className="space-y-12 pt-20 relative z-10">
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-700 tracking-widest text-[#a3e635] uppercase">
                INTRODUCING THE STORE NETWORK
              </h3>
              <p className="text-2xl font-header font-700 text-white uppercase max-w-xl">
                One view of every shortage, every negotiation, and every decision happening across your stores.
              </p>
            </div>

            {/* Simulated High-Fidelity UI Screenshot */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden p-4 sm:p-6 space-y-6 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">CONSOLE STATE / OPERATING</span>
                <div className="flex gap-1.5">
                  <div className="size-2 rounded-full bg-red-500" />
                  <div className="size-2 rounded-full bg-yellow-500" />
                  <div className="size-2 rounded-full bg-green-500" />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                {/* Shortage Item */}
                <div className="bg-[#121214] border border-zinc-900 rounded-xl p-4 space-y-2 hover:border-red-900/50 transition-colors">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase font-700">Needs Attention</span>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-800 text-white uppercase tracking-tight">RICE BATCH A</h4>
                    <span className="text-[9px] font-mono font-700 text-red-450 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/40 uppercase">Low</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-mono">Store 1 (KRM) • Remaining: 12 units</p>
                </div>
                
                {/* Active Negotiation */}
                <div className="bg-[#121214] border border-zinc-900 rounded-xl p-4 space-y-2 hover:border-indigo-900/50 transition-colors">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase font-700">Active Negotiation</span>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-800 text-white uppercase tracking-tight">Rice Negotiation</h4>
                    <span className="text-[9px] font-mono font-700 text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/40 uppercase">Running</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-mono">Store 1 ↔ Store 3 (Surplus node)</p>
                </div>

                {/* Arbitrator Resolved Transfer */}
                <div className="bg-[#121214] border border-zinc-900 rounded-xl p-4 space-y-2 hover:border-emerald-900/50 transition-colors">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase font-700">Decision Proposal</span>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-800 text-white uppercase tracking-tight">Move 40 units</h4>
                    <span className="text-[9px] font-mono font-700 text-emerald-450 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/40 uppercase">Proposed</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-mono">Store 3 → Store 1 (Landing Check)</p>
                </div>
              </div>
            </div>

            {/* Interactive Identity Portal selector box */}
            <div id="terminal-selector" className="max-w-2xl mx-auto pt-6">
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 space-y-6 text-left shadow-[0_0_35px_rgba(163,230,53,0.06)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none font-mono text-6xl font-900 text-white">
                  PLATFORM
                </div>
                
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-zinc-855 border border-zinc-700 rounded-full text-[9px] font-mono font-700 text-[#a3e635] uppercase tracking-wider">
                    <span className="size-1.5 rounded-full bg-[#a3e635] animate-pulse-dot" />
                    Secure Identity Select
                  </span>
                  <h4 className="text-lg font-header font-700 text-white uppercase tracking-wide">
                    Connect Console Portal
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Establish your Organization and Store Node context to enter the operational dashboard workspace.
                  </p>
                </div>

                {isLoadingOrgs ? (
                  <div className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
                ) : (
                  <form onSubmit={handleSelectIdentity} className="space-y-4 text-xs">
                    {/* Organization dropdown */}
                    <div className="space-y-1.5">
                      <label className="block font-700 text-zinc-300 uppercase tracking-widest text-[9px] font-mono">
                        Organization Domain
                      </label>
                      <select
                        required
                        value={selectedOrgId}
                        onChange={(e) => {
                          setSelectedOrgId(e.target.value);
                          setSelectedStoreId("");
                        }}
                        className="w-full px-3 py-3 border border-zinc-800 rounded-xl bg-black text-white focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635]/20 transition-all font-mono text-xs cursor-pointer"
                      >
                        <option value="">-- Choose Organization --</option>
                        {orgs?.map((org) => (
                          <option key={org.org_id} value={org.org_id}>
                            {org.org_name} (ID: {org.org_id})
                        </option>
                      ))}
                      </select>
                    </div>

                    {/* Store dropdown */}
                    {selectedOrgId && (
                      <div className="space-y-1.5 animate-fade-in">
                        <label className="block font-700 text-zinc-300 uppercase tracking-widest text-[9px] font-mono">
                          Store Location Node
                        </label>
                        {isLoadingStores ? (
                          <div className="h-10 bg-zinc-800 rounded-xl animate-pulse" />
                        ) : (
                          <select
                            required
                            value={selectedStoreId}
                            onChange={(e) => setSelectedStoreId(e.target.value)}
                            className="w-full px-3 py-3 border border-zinc-850 bg-black text-white focus:outline-none focus:border-[#a3e635] focus:ring-1 focus:ring-[#a3e635]/20 transition-all font-mono text-xs cursor-pointer"
                          >
                            <option value="">-- Choose Store Node --</option>
                            {stores?.map((store) => (
                              <option key={store.store_id} value={store.store_id}>
                                {store.location_name} (ID: {store.store_id})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full justify-center py-3.5 bg-white text-black hover:bg-[#a3e635] hover:text-black font-700 uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-md active:scale-[0.99] font-mono border border-transparent hover:border-[#a3e635]"
                        disabled={!selectedOrgId || !selectedStoreId || isSubmitting}
                        loading={isSubmitting}
                      >
                        Launch Node Session
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>

          </div>

          {/* Three Core Capabilities Section */}
          <div className="space-y-12 pt-20 border-t border-zinc-800 relative z-10">
            <div className="space-y-2">
              <h3 className="text-3xl font-header font-700 text-white uppercase tracking-tight">
                Three Core Capabilities
              </h3>
              <p className="text-xs text-zinc-400 max-w-xl">
                Bridging network intelligence with local store execution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Signals capability */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4 hover:border-zinc-800 hover:shadow-[0_0_15px_rgba(163,230,53,0.04)] transition-all">
                <div className="size-10 rounded-xl bg-[#a3e635]/10 border border-[#a3e635]/20 flex items-center justify-center text-[#a3e635]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4.5 16.5c-1.5-1.25-2.5-3.25-2.5-5.5s1-4.25 2.5-5.5" />
                    <path d="M7.5 13.5c-.75-.625-1.25-1.625-1.25-2.75s.5-2.125 1.25-2.75" />
                    <circle cx="12" cy="11" r="2" />
                    <path d="M16.5 8c.75.625 1.25 1.625 1.25 2.75s-.5 2.125-1.25 2.75" />
                    <path d="M19.5 5.5c1.5 1.25 2.5 3.25 2.5 5.5s-1 4.25-2.5 5.5" />
                  </svg>
                </div>
                <h4 className="text-base font-header font-700 text-white uppercase tracking-wide">SIGNALS</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Prediction and real-time inventory checks identify the stores and items that need attention.
                </p>
              </div>

              {/* Agents capability */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4 hover:border-zinc-800 hover:shadow-[0_0_15px_rgba(240,240,240,0.02)] transition-all">
                <div className="size-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-[#facc15]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="7" height="7" rx="1.5" />
                    <rect x="15" y="2" width="7" height="7" rx="1.5" />
                    <rect x="2" y="15" width="7" height="7" rx="1.5" />
                    <rect x="15" y="15" width="7" height="7" rx="1.5" />
                    <line x1="9" y1="5.5" x2="15" y2="5.5" stroke="currentColor" />
                    <line x1="5.5" y1="9" x2="5.5" y2="15" stroke="currentColor" />
                  </svg>
                </div>
                <h4 className="text-base font-header font-700 text-white uppercase tracking-wide">AGENTS</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Every store has an agent that represents its inventory needs and negotiates with other stores when stock is scarce.
                </p>
              </div>

              {/* Decisions capability */}
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 space-y-4 hover:border-zinc-800 hover:shadow-[0_0_15px_rgba(240,240,240,0.02)] transition-all">
                <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <h4 className="text-base font-header font-700 text-white uppercase tracking-wide">DECISIONS</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  A neutral arbitrator resolves contested shortages and turns the negotiation into a clear operational recommendation.
                </p>
              </div>
            </div>
          </div>

        </section>

        {/* ─── Light Gray Use-Case Section with Card Carousel (Flush Edge-to-Edge, Rounded Top Edge) ─ */}
        <section id="use-cases" className="bg-[#e8e8e5] text-zinc-900 px-6 md:px-12 py-24 sm:py-32 rounded-t-[36px] relative z-10">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div className="space-y-3">
              <h2 className="text-4xl sm:text-5xl font-header font-700 tracking-tight leading-[0.95] uppercase text-black">
                SOLVE THE PROBLEMS<br />
                THAT ACTUALLY MATTER.
              </h2>
              <p className="text-xs text-zinc-650 max-w-md">
                From sudden shortages to contested store inventory, the system turns operational problems into decisions.
              </p>
            </div>
            
            {/* Carousel navigation buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => scrollCarousel("left")}
                className="size-10 rounded-full border border-zinc-350 hover:border-black hover:bg-white/40 flex items-center justify-center transition-all"
                title="Scroll Left"
              >
                ←
              </button>
              <button
                onClick={() => scrollCarousel("right")}
                className="size-10 rounded-full border border-zinc-350 hover:border-black hover:bg-white/40 flex items-center justify-center transition-all"
                title="Scroll Right"
              >
                →
              </button>
            </div>
          </div>

          {/* Carousel wrapper */}
          <div
            ref={carouselRef}
            className="flex gap-6 overflow-x-auto pb-6 scrollbar-none snap-x snap-mandatory"
            style={{ scrollbarWidth: "none" }}
          >
            {/* CARD 1 */}
            <div className="min-w-[280px] sm:min-w-[320px] bg-white rounded-2xl p-6 flex flex-col justify-between h-[360px] border border-zinc-200/60 snap-start shadow-sm hover:border-[#a3e635]/40 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="size-16 rounded-xl bg-lime-100/70 border border-lime-200/50 flex items-center justify-center text-2xl">
                  📉
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-mono font-800 text-[#a3e635] uppercase tracking-widest">Category / Alert</span>
                  <h4 className="text-lg font-header font-700 text-black uppercase leading-tight">SUDDEN SHORTAGE</h4>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    A large sale pushes a store below its critical stock level. The system reacts immediately instead of waiting for the next prediction cycle.
                  </p>
                </div>
              </div>
              <button onClick={scrollToSelector} className="text-[10px] font-mono font-700 text-zinc-500 hover:text-black uppercase tracking-wider text-left pt-2">
                Explore →
              </button>
            </div>

            {/* CARD 2 */}
            <div className="min-w-[280px] sm:min-w-[320px] bg-white rounded-2xl p-6 flex flex-col justify-between h-[360px] border border-zinc-200/60 snap-start shadow-sm hover:border-purple-300/40 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="size-16 rounded-xl bg-purple-100/70 border border-purple-200/50 flex items-center justify-center text-2xl">
                  ⚖️
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-mono font-800 text-purple-500 uppercase tracking-widest">Category / Negotiation</span>
                  <h4 className="text-lg font-header font-700 text-black uppercase leading-tight">COMPETING FOR STOCK</h4>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Two stores need the same limited surplus. Their agents negotiate while a neutral arbitrator resolves the conflict.
                  </p>
                </div>
              </div>
              <button onClick={scrollToSelector} className="text-[10px] font-mono font-700 text-zinc-500 hover:text-black uppercase tracking-wider text-left pt-2">
                Explore →
              </button>
            </div>

            {/* CARD 3 */}
            <div className="min-w-[280px] sm:min-w-[320px] bg-white rounded-2xl p-6 flex flex-col justify-between h-[360px] border border-zinc-200/60 snap-start shadow-sm hover:border-blue-350/40 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="size-16 rounded-xl bg-blue-100/70 border border-blue-200/50 flex items-center justify-center text-2xl">
                  🌐
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-mono font-800 text-blue-500 uppercase tracking-widest">Category / Escalate</span>
                  <h4 className="text-lg font-header font-700 text-black uppercase leading-tight">NO VIABLE TRANSFER</h4>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    No store can supply the item fast enough. The system escalates to the configured supplier instead.
                  </p>
                </div>
              </div>
              <button onClick={scrollToSelector} className="text-[10px] font-mono font-700 text-zinc-500 hover:text-black uppercase tracking-wider text-left pt-2">
                Explore →
              </button>
            </div>

            {/* CARD 4 */}
            <div className="min-w-[280px] sm:min-w-[320px] bg-white rounded-2xl p-6 flex flex-col justify-between h-[360px] border border-zinc-200/60 snap-start shadow-sm hover:border-amber-300/40 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="size-16 rounded-xl bg-amber-100/70 border border-amber-200/50 flex items-center justify-center text-2xl">
                  ⏳
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-mono font-800 text-amber-500 uppercase tracking-widest">Category / Lifecycle</span>
                  <h4 className="text-lg font-header font-700 text-black uppercase leading-tight">EXPIRING INVENTORY</h4>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Near-expiry stock is surfaced separately so managers can act before inventory becomes unusable.
                  </p>
                </div>
              </div>
              <button onClick={scrollToSelector} className="text-[10px] font-mono font-700 text-zinc-500 hover:text-black uppercase tracking-wider text-left pt-2">
                Explore →
              </button>
            </div>

            {/* CARD 5 */}
            <div className="min-w-[280px] sm:min-w-[320px] bg-white rounded-2xl p-6 flex flex-col justify-between h-[360px] border border-zinc-200/60 snap-start shadow-sm hover:border-emerald-300/40 hover:shadow-md transition-all">
              <div className="space-y-4">
                <div className="size-16 rounded-xl bg-emerald-100/70 border border-emerald-200/50 flex items-center justify-center text-2xl">
                  ✅
                </div>
                <div className="space-y-2">
                  <span className="text-[9px] font-mono font-800 text-emerald-500 uppercase tracking-widest">Category / Transfer</span>
                  <h4 className="text-lg font-header font-700 text-black uppercase leading-tight">TRANSFER CONFIRMATION</h4>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Every involved store confirms the physical movement before inventory is updated.
                  </p>
                </div>
              </div>
              <button onClick={scrollToSelector} className="text-[10px] font-mono font-700 text-zinc-500 hover:text-black uppercase tracking-wider text-left pt-2">
                Explore →
              </button>
            </div>

          </div>

        </section>

        {/* ─── Next White Section (Store Network Differentiator, Flush, Rounded Top Edge) ───────── */}
        <section id="store-network" className="bg-[#ffffff] px-6 md:px-12 py-24 sm:py-32 rounded-t-[36px] relative overflow-hidden z-10 -mt-8">
          
          <div className="absolute right-[-100px] top-[10%] w-[350px] h-[350px] bg-gradient-to-l from-lime-300/10 to-transparent blur-[120px] rounded-full pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Description */}
            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-header font-700 tracking-tight leading-[0.92] uppercase text-black">
                FINALLY, INVENTORY AI<br />
                THAT UNDERSTANDS<br />
                THE STORE NEXT DOOR.
              </h2>
              
              <div className="space-y-4 text-xs sm:text-sm text-zinc-650 leading-relaxed max-w-xl">
                <p className="font-850 text-black">Most inventory systems think store by store.</p>
                <p className="font-850 text-black bg-gradient-to-r from-lime-400 to-yellow-350 px-3 py-1.5 rounded inline-block">This one thinks across the network.</p>
                <p>
                  Every store has its own agent. When inventory becomes scarce, those agents can negotiate with one another while a neutral arbitrator resolves competing needs.
                </p>
              </div>
            </div>

            {/* Abstract store network diagram visual */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="size-64 sm:size-72 border border-zinc-200 bg-zinc-50 rounded-2xl shadow-sm relative overflow-hidden flex items-center justify-center hover:border-zinc-400 transition-colors">
                <div className="text-center font-mono text-[9px] text-zinc-400 uppercase tracking-widest space-y-6 p-4">
                  <div className="flex justify-center gap-8">
                    <span className="p-2 border border-zinc-200 rounded-lg bg-white font-700 text-black">STORE 1</span>
                    <span className="p-2 border border-zinc-200 rounded-lg bg-white font-700 text-black">STORE 2</span>
                  </div>
                  <div className="text-zinc-600 font-900 animate-pulse">⇅ AGENT NEGOTIATION ⇅</div>
                  <div className="p-3 border border-[#a3e635] bg-black text-[#a3e635] rounded-xl font-900 inline-block shadow-[0_0_15px_rgba(163,230,53,0.15)]">
                    ARBITRATOR NODE
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* ─── Human Control Section (Continues in White, Flush) ────────────────────────────────── */}
        <section className="bg-[#ffffff] px-6 md:px-12 py-20 sm:py-24 space-y-12 z-10 relative">
          
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl sm:text-5xl font-header font-700 tracking-tight leading-[0.92] uppercase text-black">
              AI DOES THE THINKING.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-amber-500 font-bold">YOU STAY IN CONTROL.</span>
            </h2>
            <div className="space-y-2 text-xs sm:text-sm text-zinc-650 leading-relaxed">
              <p>
                Agents detect shortages, investigate available inventory, negotiate, and recommend what should happen next.
              </p>
              <p className="font-850 text-black">
                A human still approves every stock-moving decision and confirms the physical transfer.
              </p>
            </div>
          </div>

          {/* Process flow layout */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-6 font-mono text-[10px] text-center uppercase tracking-wide">
            {["AI Detects", "AI Negotiates", "AI Recommends", "You Approve", "You Confirm", "Inventory Updated"].map((step, idx) => (
              <div key={step} className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col justify-between h-[100px] shadow-sm relative group hover:border-[#a3e635] transition-all duration-300">
                <span className="text-[#a3e635] group-hover:text-amber-500 font-900 text-left transition-colors">0{idx + 1}</span>
                <span className="font-800 text-zinc-900 text-xs tracking-tight">{step}</span>
              </div>
            ))}
          </div>

        </section>

        {/* ─── Network Capability Grid Section (Flush, Rounded Top Edge) ────────────────────────── */}
        <section className="bg-[#e8e8e5] text-zinc-900 px-6 md:px-12 py-24 sm:py-32 rounded-t-[36px] relative z-10 -mt-8">
          
          <div className="space-y-3 mb-12">
            <h2 className="text-4xl font-header font-700 tracking-tight leading-[0.95] uppercase text-black">
              ONE NETWORK.<br />
              EVERY STORE.<br />
              BETTER DECISIONS.
            </h2>
            <p className="text-xs text-zinc-650">Your stores no longer operate as isolated inventory systems.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 font-mono text-[10px]">
            {[
              { t: "PREDICTION", d: "Forecasts inventory limits using advanced models." },
              { t: "REAL-TIME RISK", d: "Alerts when safety stock targets are broken." },
              { t: "STORE AGENTS", d: "Independent agents represent store-level needs." },
              { t: "NEGOTIATION", d: "Automated routing and deficit balancing." },
              { t: "ARBITRATION", d: "Dispute resolver that prioritizes systemic health." },
              { t: "HUMAN CONTROL", d: "Verification hooks require physical approvals." }
            ].map((cell) => (
              <div key={cell.t} className="bg-white rounded-xl p-5 border border-zinc-250/60 shadow-sm space-y-2 hover:border-[#a3e635]/40 hover:shadow-md transition-all duration-300">
                <span className="font-900 text-[#a3e635] text-xs">■</span>
                <h4 className="font-800 text-black text-xs uppercase tracking-wider">{cell.t}</h4>
                <p className="text-[10px] text-zinc-600 font-sans tracking-normal leading-relaxed">{cell.d}</p>
              </div>
            ))}
          </div>

        </section>

        {/* ─── Built Around the Way Retail Actually Works (Flush, Rounded Top Edge) ──────────────── */}
        <section className="bg-[#ffffff] px-6 md:px-12 py-24 sm:py-32 rounded-t-[36px] relative z-10 -mt-8 space-y-8 text-center shadow-sm">
          <div className="space-y-3">
            <h2 className="text-3xl font-header font-700 tracking-tight leading-[0.95] uppercase text-black">
              BUILT AROUND THE WAY RETAIL ACTUALLY WORKS.
            </h2>
            <p className="text-xs text-zinc-500 max-w-xl mx-auto">
              No generic workflows. Customized operational loops for multi-store network replenishment.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-6 font-mono text-[9px] tracking-widest">
            {[
              "MULTI-STORE INVENTORY",
              "DEMAND FORECASTING",
              "SURPLUS DETECTION",
              "AGENT NEGOTIATION",
              "SUPPLIER ESCALATION",
              "TRANSFER CONFIRMATION"
            ].map((badge) => (
              <div key={badge} className="bg-black text-white font-900 py-4.5 px-3 rounded-2xl shadow-sm border border-zinc-900 flex items-center justify-center text-center leading-snug hover:bg-[#a3e635] hover:text-black hover:border-[#a3e635] hover:shadow-[0_0_15px_rgba(163,230,53,0.15)] transition-all cursor-pointer">
                {badge}
              </div>
            ))}
          </div>
        </section>

        {/* ─── Final CTA Section (Flush, Rounded Top Edge) ───────────────────────────────────────── */}
        <section className="bg-[#e8e8e5] text-zinc-900 px-6 md:px-12 py-24 sm:py-32 rounded-t-[36px] text-center space-y-6 relative overflow-hidden z-10 -mt-8">
          <div className="absolute inset-0 bg-gradient-to-t from-lime-300/10 to-transparent blur-3xl rounded-full pointer-events-none" />
          
          <h2 className="text-4xl sm:text-6xl font-header font-700 tracking-tight leading-[0.9] uppercase text-black relative z-10">
            RUN YOUR STORE NETWORK<br />
            LIKE ONE SYSTEM.
          </h2>
          <p className="text-xs text-zinc-650 max-w-md mx-auto relative z-10">
            Let the agents handle the coordination. Give your team the final say.
          </p>
          <div className="pt-4 relative z-10">
            <button
              onClick={scrollToSelector}
              className="bg-black text-white hover:bg-[#a3e635] hover:text-black border border-transparent hover:border-[#a3e635] px-8 py-3 rounded-full font-700 text-xs transition-all uppercase tracking-widest shadow-md hover:scale-[1.02] active:scale-[0.98]"
            >
              Open Platform Gateway
            </button>
          </div>
        </section>

        {/* ─── Footer (Flush, Rounded Top Edge) ─────────────────────────────────────────────────── */}
        <footer className="bg-black text-white px-6 md:px-12 py-16 rounded-t-[36px] text-xs space-y-12 z-20 relative -mt-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-4 space-y-3">
              <span className="font-header font-700 tracking-wider text-xl uppercase text-white">NODE</span>
              <p className="text-xs text-zinc-550 leading-relaxed font-mono">
                AI-powered inventory coordination for multi-store retail.
              </p>
            </div>
            
            <div className="md:col-span-8 grid grid-cols-3 gap-6 font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
              <div className="space-y-3">
                <h5 className="font-900 text-white text-xs">Platform</h5>
                <ul className="space-y-2">
                  <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
                  <li><Link href="/inventory" className="hover:text-white">Inventory</Link></li>
                  <li><Link href="/predictions" className="hover:text-white">Predictions</Link></li>
                </ul>
              </div>
              <div className="space-y-3">
                <h5 className="font-900 text-white text-xs">Logistics</h5>
                <ul className="space-y-2">
                  <li><Link href="/negotiations" className="hover:text-white">Negotiations</Link></li>
                  <li><Link href="/transfers" className="hover:text-white">Transfers</Link></li>
                  <li><Link href="/expiry" className="hover:text-white">Expiry Alerts</Link></li>
                </ul>
              </div>
              <div className="space-y-3">
                <h5 className="font-900 text-white text-xs">Management</h5>
                <ul className="space-y-2">
                  <li><Link href="/suppliers" className="hover:text-white">Suppliers</Link></li>
                  <li><Link href="/configuration" className="hover:text-white">Configuration</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-8 flex justify-between items-center font-mono text-zinc-650 text-[10px]">
            <span>© 2026 Node Multi-Store Agentic Copilot.</span>
            <span>All rights reserved.</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
