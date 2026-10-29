"use client";

import { motion } from "motion/react";

export function FlavorPicker({
  flavors,
  value,
  onChange,
}: {
  flavors: string[];
  value: string;
  onChange: (f: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sabor">
      {flavors.map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f)}
            className={`relative rounded-xl border px-3.5 py-2 text-sm transition active:scale-95 ${
              active ? "border-brand text-black" : "border-line bg-surface-2 text-white/85 hover:border-brand/50"
            }`}
          >
            {active && (
              <motion.span layoutId="flavor-active" className="absolute inset-0 rounded-[10px] bg-brand" transition={{ type: "spring", damping: 25, stiffness: 350 }} />
            )}
            <span className="relative font-medium">{f}</span>
          </button>
        );
      })}
    </div>
  );
}
