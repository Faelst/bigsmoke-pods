"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Flame, Plus, Sparkles, Wind } from "lucide-react";
import { brl } from "@/lib/format";
import type { Product } from "@/lib/products";

export function ProductCard({ product, index, onAdd }: { product: Product; index: number; onAdd: (p: Product) => void }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.3) }}
      whileHover={{ y: -6 }}
      className="group card relative flex flex-col overflow-hidden transition-colors hover:border-brand/50"
    >
      <Link href={`/produto/${product.slug}`} className="relative block aspect-square overflow-hidden bg-white">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-contain p-3 transition duration-500 group-hover:scale-110"
        />
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.bestseller && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
              <Flame className="size-3" /> Mais vendido
            </span>
          )}
          {product.isNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-leaf px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
              <Sparkles className="size-3" /> Novidade
            </span>
          )}
          {product.badge && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black ring-1 ring-black/10">{product.badge}</span>
          )}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-leaf">{product.brand}</span>
        <Link href={`/produto/${product.slug}`} className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
          {product.name}
        </Link>
        <span className="flex items-center gap-1 text-xs text-muted">
          <Wind className="size-3.5" /> {product.puffs} puffs
        </span>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-display text-base text-brand sm:text-lg">{brl(product.price)}</span>
          <motion.button
            whileTap={{ scale: 0.85, rotate: 90 }}
            onClick={() => onAdd(product)}
            aria-label={`Adicionar ${product.name}`}
            className="grid size-10 place-items-center rounded-xl bg-brand text-black shadow-[0_6px_20px_-6px_rgb(255_178_0/0.7)]"
          >
            <Plus className="size-5" />
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}
