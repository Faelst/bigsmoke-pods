"use client";

import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { brandsOf, filterProducts, type Product } from "@/lib/products";
import { ProductCard } from "./ProductCard";
import { QuickAddSheet } from "./QuickAddSheet";

type Chip = { id: string; label: string; match: (p: Product) => boolean };

export function Catalog({ products: all }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("todos");
  const [quickAdd, setQuickAdd] = useState<Product | null>(null);
  const deferred = useDeferredValue(query);

  // Filtros: todos, marcações do admin (mais vendidos/novidades) e marcas.
  const chips = useMemo(() => {
    const list: Chip[] = [
      { id: "todos", label: "Todos", match: () => true },
      { id: "bestseller", label: "🔥 Mais vendidos", match: (p) => !!p.bestseller },
      { id: "new", label: "✨ Novidades", match: (p) => !!p.isNew },
      ...brandsOf(all).map((b): Chip => ({ id: `brand:${b}`, label: b, match: (p) => p.brand === b })),
    ];
    return list.filter((c) => all.some(c.match));
  }, [all]);
  const current = chips.find((c) => c.id === chip) ?? chips[0];
  const products = useMemo(() => filterProducts(all.filter(current.match), deferred), [all, current, deferred]);

  return (
    <section id="busca" className="mx-auto max-w-6xl scroll-mt-20 px-4">
      <div className="sticky top-16 z-20 -mx-4 bg-bg/85 px-4 pb-3 pt-4 backdrop-blur-xl">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pods por nome, marca ou sabor…"
            className="input pl-12! pr-12!"
            aria-label="Buscar produtos"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-line/60"
            >
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {chips.map((c) => {
            const active = current.id === c.id;
            const count = all.filter(c.match).length;
            return (
              <button
                key={c.id}
                onClick={() => setChip(c.id)}
                className={`relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${active ? "text-black" : "bg-surface-2 text-muted hover:text-white"}`}
              >
                {active && <motion.span layoutId="chip" className="absolute inset-0 rounded-full bg-brand" />}
                <span className="relative">
                  {c.label} <span className="opacity-60">{count}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {products.map((p, i) => (
            <ProductCard key={p.slug} product={p} index={i} onAdd={setQuickAdd} />
          ))}
        </AnimatePresence>
      </div>

      {products.length === 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center text-muted">
          Nenhum pod encontrado para “{query}”.
        </motion.p>
      )}

      <QuickAddSheet product={quickAdd} onClose={() => setQuickAdd(null)} />
    </section>
  );
}
