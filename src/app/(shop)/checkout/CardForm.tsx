"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { brl, onlyDigits } from "@/lib/format";
import { cardBrand } from "@/lib/validation";

export type CardData = { number: string; name: string; expiry: string; cvv: string; installments: number };

const formatNumber = (v: string) => onlyDigits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (v: string) => {
  const d = onlyDigits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export function CardForm({ value, onChange, total }: { value: CardData; onChange: (c: CardData) => void; total: number }) {
  const [flipped, setFlipped] = useState(false);
  const set = (patch: Partial<CardData>) => onChange({ ...value, ...patch });
  const digits = onlyDigits(value.number);
  const brand = digits.length >= 2 ? cardBrand(digits) : "";

  return (
    <div className="flex flex-col gap-5">
      {/* Cartão animado */}
      <div className="mx-auto w-full max-w-xs [perspective:1200px]">
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          className="relative aspect-[1.586] w-full [transform-style:preserve-3d]"
        >
          <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand-2 to-leaf-dark p-5 text-black shadow-2xl [backface-visibility:hidden]">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/25 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-100 to-yellow-500 shadow-inner" />
              <span className="text-sm font-bold italic">{brand}</span>
            </div>
            <p className="relative font-mono text-lg tracking-widest">{value.number || "•••• •••• •••• ••••"}</p>
            <div className="relative flex justify-between text-xs font-semibold uppercase">
              <span className="truncate pr-2">{value.name || "Nome no cartão"}</span>
              <span>{value.expiry || "MM/AA"}</span>
            </div>
          </div>
          <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="mt-6 h-10 bg-black" />
            <div className="mx-5 mt-4 flex h-9 items-center justify-end rounded bg-white/90 px-3 font-mono text-black">{value.cvv || "•••"}</div>
          </div>
        </motion.div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Número do cartão</span>
        <input className="input font-mono" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
          value={value.number} onChange={(e) => set({ number: formatNumber(e.target.value) })} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Nome impresso no cartão</span>
        <input className="input uppercase" autoComplete="cc-name" placeholder="NOME SOBRENOME"
          value={value.name} onChange={(e) => set({ name: e.target.value.toUpperCase() })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Validade</span>
          <input className="input" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA"
            value={value.expiry} onChange={(e) => set({ expiry: formatExpiry(e.target.value) })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">CVV</span>
          <input className="input" inputMode="numeric" autoComplete="cc-csc" placeholder="123"
            value={value.cvv} onFocus={() => setFlipped(true)} onBlur={() => setFlipped(false)}
            onChange={(e) => set({ cvv: onlyDigits(e.target.value).slice(0, 4) })} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Parcelas</span>
        <select className="input appearance-none" value={value.installments} onChange={(e) => set({ installments: Number(e.target.value) })}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>{n}x de {brl(total / n)} sem juros</option>
          ))}
        </select>
      </label>
      <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
        Teste: use <span className="font-mono text-white">4242 4242 4242 4242</span> (aprovado) ou{" "}
        <span className="font-mono text-white">4000 0000 0000 0002</span> (recusado), com qualquer validade futura e CVV.
      </p>
    </div>
  );
}
