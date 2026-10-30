"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { cart } from "@/lib/cart";
import { brl } from "@/lib/format";
import { firstAvailable, type Product } from "@/lib/products";
import { FlavorPicker } from "@/components/FlavorPicker";

export function AddToCart({ product }: { product: Product }) {
  const [flavor, setFlavor] = useState(firstAvailable(product));
  const [qty, setQty] = useState(1);
  const stock = product.flavors.find((f) => f.name === flavor)?.stock ?? 0;
  const max = Math.min(20, stock);
  const pick = (f: string) => {
    setFlavor(f);
    setQty((q) => Math.max(1, Math.min(q, product.flavors.find((x) => x.name === f)?.stock ?? 1)));
  };

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold text-muted">Sabor</p>
      <FlavorPicker flavors={product.flavors} value={flavor} onChange={pick} />

      {/* Barra fixa no mobile, inline no desktop */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex gap-3 border-t border-line bg-bg/90 p-3 backdrop-blur-xl md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface-2 p-1">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir" className="grid size-10 place-items-center rounded-xl hover:bg-surface">
            <Minus className="size-4" />
          </button>
          <span className="w-7 text-center font-semibold">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="Aumentar" className="grid size-10 place-items-center rounded-xl hover:bg-surface disabled:opacity-30">
            <Plus className="size-4" />
          </button>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => cart.add(product, flavor, qty)} disabled={stock <= 0} className="btn-brand flex-1 disabled:opacity-50">
          <ShoppingBag className="size-5" /> {stock > 0 ? `Adicionar • ${brl(product.price * qty)}` : "Esgotado"}
        </motion.button>
      </div>
    </div>
  );
}
