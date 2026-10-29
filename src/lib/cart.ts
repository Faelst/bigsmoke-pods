"use client";

import { createStore, useStore } from "./store";
import type { Product } from "./products";

export type CartItem = {
  slug: string;
  name: string;
  image: string;
  price: number;
  flavor: string;
  qty: number;
};

const KEY = "bsp_cart";
const cartStore = createStore<CartItem[]>([]);
const uiStore = createStore({ open: false, toast: null as string | null, bump: 0 });

if (typeof window !== "undefined") {
  try {
    cartStore.set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {}
  cartStore.subscribe(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cartStore.get()));
    } catch {}
  });
}

const same = (a: CartItem, slug: string, flavor: string) => a.slug === slug && a.flavor === flavor;

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const cart = {
  add(p: Product, flavor: string, qty = 1) {
    cartStore.set((items) =>
      items.some((i) => same(i, p.slug, flavor))
        ? items.map((i) => (same(i, p.slug, flavor) ? { ...i, qty: Math.min(i.qty + qty, 20) } : i))
        : [...items, { slug: p.slug, name: p.name, image: p.image, price: p.price, flavor, qty }],
    );
    clearTimeout(toastTimer);
    uiStore.set((s) => ({ ...s, toast: `${p.name} • ${flavor}`, bump: s.bump + 1 }));
    toastTimer = setTimeout(() => uiStore.set((s) => ({ ...s, toast: null })), 2200);
  },
  setQty(slug: string, flavor: string, qty: number) {
    cartStore.set((items) =>
      qty <= 0
        ? items.filter((i) => !same(i, slug, flavor))
        : items.map((i) => (same(i, slug, flavor) ? { ...i, qty: Math.min(qty, 20) } : i)),
    );
  },
  clear: () => cartStore.set([]),
  open: () => uiStore.set((s) => ({ ...s, open: true })),
  close: () => uiStore.set((s) => ({ ...s, open: false })),
};

export function useCart() {
  const items = useStore(cartStore);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  return { items, count, total };
}

export const useCartUI = () => useStore(uiStore);
