"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface LatexProps {
  math: string;
  block?: boolean;
  className?: string;
}

export function Latex({ math, block = false, className = "" }: LatexProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
      });
    } catch {
      return math;
    }
  }, [math, block]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface FormulaProps {
  className?: string;
}

export function ROPFormula({ className }: FormulaProps) {
  return (
    <div
      className={`bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-center overflow-x-auto shadow-2xs ${className ?? ""}`}
    >
      <Latex
        math={"\\mathrm{ROP} = (\\hat{d} \\times L) + z \\cdot \\sigma_d \\cdot \\sqrt{L}"}
        block
        className="text-zinc-900 text-sm md:text-base font-600"
      />
    </div>
  );
}

export function EOQFormula({ className }: FormulaProps) {
  return (
    <div
      className={`bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-center overflow-x-auto shadow-2xs ${className ?? ""}`}
    >
      <Latex
        math={"\\mathrm{EOQ} = \\sqrt{\\frac{2 \\times D \\times S}{H}}"}
        block
        className="text-zinc-900 text-sm md:text-base font-600"
      />
    </div>
  );
}

export function FormulaLegend() {
  const items = [
    { symbol: "\\hat{d}", desc: "Predicted daily demand (XGBoost)" },
    { symbol: "L", desc: "Supplier lead time (days)" },
    { symbol: "z", desc: "Service level z-score (95% → 1.65)" },
    { symbol: "\\sigma_d", desc: "Demand standard deviation" },
    { symbol: "D", desc: "Annual demand" },
    { symbol: "S", desc: "Order setup cost per order" },
    { symbol: "H", desc: "Annual holding cost per unit" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 text-[11px] text-zinc-600 mt-3 pt-3 border-t border-zinc-100">
      {items.map((item) => (
        <div key={item.desc} className="flex items-center gap-1.5">
          <Latex math={item.symbol} className="font-600 text-zinc-900" />
          <span className="text-zinc-500">= {item.desc}</span>
        </div>
      ))}
    </div>
  );
}
