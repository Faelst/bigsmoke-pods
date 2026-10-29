"use client";

import type { Address, Contact } from "./types";

// Memória do aparelho (compra sem conta): pedidos feitos aqui e os dados do
// último checkout para preencher o próximo. localStorage pode falhar (aba
// anônima, bloqueio), então tudo é best-effort.
const ORDERS_KEY = "bsp_orders";
const CHECKOUT_KEY = "bsp_checkout";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const deviceOrderIds = () => read<string[]>(ORDERS_KEY, []);
export const rememberOrder = (id: string) => write(ORDERS_KEY, [id, ...deviceOrderIds().filter((x) => x !== id)].slice(0, 100));

export type SavedCheckout = { contact: Contact; address: Address };
export const savedCheckout = () => read<SavedCheckout | null>(CHECKOUT_KEY, null);
export const saveCheckout = (data: SavedCheckout) => write(CHECKOUT_KEY, data);
