"use client";

import React from "react";

/**
 * Lightweight math formula renderer using HTML math entities.
 * Renders formulas with proper mathematical notation without
 * requiring external dependencies like KaTeX or MathJax.
 */

interface FormulaProps {
  className?: string;
}

export function ROPFormula({ className }: FormulaProps) {
  return (
    <div
      className={`font-serif text-zinc-900 bg-zinc-50 border border-zinc-150 rounded p-3 text-center text-sm ${className ?? ""}`}
    >
      <span className="italic">ROP</span>
      <span className="mx-1">=</span>
      <span>(</span>
      <span className="italic" style={{ textDecoration: "none" }}>d&#x0302;</span>
      <span className="mx-0.5">×</span>
      <span className="italic">L</span>
      <span>)</span>
      <span className="mx-1">+</span>
      <span className="italic">z</span>
      <span className="mx-0.5">·</span>
      <span className="italic">&sigma;</span>
      <sub className="text-[9px]"><span className="italic">d</span></sub>
      <span className="mx-0.5">·</span>
      <span>&radic;</span>
      <span style={{ textDecoration: "overline" }} className="italic">L</span>
    </div>
  );
}

export function EOQFormula({ className }: FormulaProps) {
  return (
    <div
      className={`font-serif text-zinc-900 bg-zinc-50 border border-zinc-150 rounded p-3 text-center text-sm ${className ?? ""}`}
    >
      <span className="italic">EOQ</span>
      <span className="mx-1">=</span>
      <span className="text-lg leading-none" style={{ verticalAlign: "-2px" }}>&radic;</span>
      <span style={{ borderTop: "1.5px solid #27272a", paddingTop: "2px", paddingLeft: "4px", paddingRight: "4px" }}>
        <span className="inline-flex flex-col items-center" style={{ verticalAlign: "middle" }}>
          <span className="text-xs leading-tight">
            2 × <span className="italic">D</span> × <span className="italic">S</span>
          </span>
          <span className="w-full border-t border-zinc-400 my-0.5" />
          <span className="text-xs leading-tight">
            <span className="italic">H</span>
          </span>
        </span>
      </span>
    </div>
  );
}

export function FormulaLegend() {
  const items = [
    { symbol: "d\u0302", desc: "Predicted daily demand (XGBoost)" },
    { symbol: "L", desc: "Supplier lead time (days)" },
    { symbol: "z", desc: "Service level z-score (95% → 1.65)" },
    { symbol: "σ_d", desc: "Demand standard deviation" },
    { symbol: "D", desc: "Annual demand" },
    { symbol: "S", desc: "Order (setup) cost per order" },
    { symbol: "H", desc: "Annual holding cost per unit" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-zinc-500 mt-2">
      {items.map((item) => (
        <div key={item.symbol} className="flex items-baseline gap-1">
          <span className="font-serif italic text-zinc-700 font-600">{item.symbol}</span>
          <span>= {item.desc}</span>
        </div>
      ))}
    </div>
  );
}
