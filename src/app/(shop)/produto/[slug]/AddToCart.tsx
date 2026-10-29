"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { cart } from "@/lib/cart";
import { brl } from "@/lib/format";
import type { Product } from "@/lib/products";
import { FlavorPicker } from "@/components/FlavorPicker";

export function AddToCart({ product }: { product: Product }) {
  const [flavor, setFlavor] = useState(product.flavors[0]);
  const [qty, setQty] = useState(1);

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold text-muted">Sabor</p>
      <FlavorPicker flavors={product.flavors} value={flavor} onChange={setFlavor} />

      {/* Barra fixa no mobile, inline no desktop */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex gap-3 border-t border-line bg-bg/90 p-3 backdrop-blur-xl md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface-2 p-1">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir" className="grid size-10 place-items-center rounded-xl hover:bg-surface">
            <Minus className="size-4" />
          </button>
          <span className="w-7 text-center font-semibold">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Aumentar" className="grid size-10 place-items-center rounded-xl hover:bg-surface">
            <Plus className="size-4" />
          </button>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => cart.add(product, flavor, qty)} className="btn-brand flex-1">
          <ShoppingBag className="size-5" /> Adicionar • {brl(product.price * qty)}
        </motion.button>
      </div>
    </div>
  );
}
