"use client";

import { motion } from "motion/react";
import type { Flavor } from "@/lib/types";

export function FlavorPicker({
  flavors,
  value,
  onChange,
}: {
  flavors: Flavor[];
  value: string;
  onChange: (f: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sabor">
      {flavors.map((f) => {
        const active = f.name === value;
        const soldOut = f.stock <= 0;
        return (
          <button
            key={f.name}
            role="radio"
            aria-checked={active}
            disabled={soldOut}
            onClick={() => onChange(f.name)}
            className={`relative rounded-xl border px-3.5 py-2 text-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? "border-brand text-black" : "border-line bg-surface-2 text-white/85 hover:border-brand/50"
            }`}
          >
            {active && (
              <motion.span layoutId="flavor-active" className="absolute inset-0 rounded-[10px] bg-brand" transition={{ type: "spring", damping: 25, stiffness: 350 }} />
            )}
            <span className={`relative font-medium ${soldOut ? "line-through" : ""}`}>{f.name}</span>
            {soldOut ? (
              <span className="relative ml-1.5 text-[10px] uppercase">Esgotado</span>
            ) : (
              f.stock <= 3 && <span className={`relative ml-1.5 text-[10px] font-semibold uppercase ${active ? "text-black/70" : "text-brand"}`}>últimas {f.stock}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
