"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cart } from "@/lib/cart";
import { brl } from "@/lib/format";
import type { Product } from "@/lib/products";
import { FlavorPicker } from "./FlavorPicker";

export function QuickAddSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {product && <Sheet key={product.slug} product={product} onClose={onClose} />}
    </AnimatePresence>
  );
}

function Sheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [flavor, setFlavor] = useState(product.flavors[0]);
  return (
    <>
      <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-label={`Escolher sabor de ${product.name}`}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-line bg-surface p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem] md:border"
        initial={{ y: "100%", opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        <div className="flex items-start gap-4">
          <Image src={product.image} alt={product.name} width={80} height={80} className="size-20 rounded-2xl bg-white object-contain" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-leaf">{product.brand}</p>
            <h3 className="font-semibold leading-tight">{product.name}</h3>
            <p className="mt-1 font-display text-lg text-brand">{brl(product.price)}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="grid size-9 place-items-center rounded-xl bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-3 mt-5 text-sm font-semibold text-muted">Escolha o sabor</p>
        <FlavorPicker flavors={product.flavors} value={flavor} onChange={setFlavor} />
        <button
          className="btn-brand mt-6 w-full"
          onClick={() => {
            cart.add(product, flavor);
            onClose();
          }}
        >
          <Plus className="size-5" /> Adicionar ao carrinho
        </button>
      </motion.div>
    </>
  );
}
