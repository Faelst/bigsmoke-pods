import "server-only";
import type { Schema } from "./db";
import type { Order, OrderItem, Product } from "./types";

// Estoque por sabor. Um PIX gerado reserva os itens (o pedido "aguardando pagamento" ainda no
// prazo); o estoque só é debitado quando o pagamento é confirmado. PIX expirado ou cancelado
// deixa de reservar, então o saldo volta sozinho.

const key = (slug: string, flavor: string) => `${slug}\n${flavor}`;

const reserves = (o: Order, now: number) =>
  o.status === "aguardando_pagamento" && !o.stockDebited && o.payment.method === "pix" && new Date(o.payment.expiresAt).getTime() > now;

export function reservedQty(db: Schema, now = Date.now()) {
  const map = new Map<string, number>();
  for (const o of db.orders)
    if (reserves(o, now)) for (const i of o.items) map.set(key(i.slug, i.flavor), (map.get(key(i.slug, i.flavor)) ?? 0) + i.qty);
  return map;
}

// Como a loja vê o produto: estoque de cada sabor já sem o que está reservado.
export function forSale(p: Product, reserved: Map<string, number>): Product {
  return { ...p, flavors: p.flavors.map((f) => ({ name: f.name, stock: Math.max(0, f.stock - (reserved.get(key(p.slug, f.name)) ?? 0)) })) };
}

// Para o admin: estoque e quanto dele está reservado.
export function withReserved(p: Product, reserved: Map<string, number>): Product {
  return { ...p, flavors: p.flavors.map((f) => ({ ...f, reserved: reserved.get(key(p.slug, f.name)) ?? 0 })) };
}

// Primeiro item do pedido sem saldo suficiente (somando linhas repetidas do mesmo sabor).
export function shortage(db: Schema, items: OrderItem[], now = Date.now()) {
  const reserved = reservedQty(db, now);
  const wanted = new Map<string, number>();
  for (const i of items) wanted.set(key(i.slug, i.flavor), (wanted.get(key(i.slug, i.flavor)) ?? 0) + i.qty);
  for (const i of items) {
    const flavor = db.products.find((p) => p.slug === i.slug)?.flavors.find((f) => f.name === i.flavor);
    const available = Math.max(0, (flavor?.stock ?? 0) - (reserved.get(key(i.slug, i.flavor)) ?? 0));
    if (wanted.get(key(i.slug, i.flavor))! > available) return { item: i, available };
  }
  return null;
}

// sign -1 debita (pagamento confirmado), +1 devolve (pedido pago cancelado antes do envio).
export function moveStock(db: Schema, items: OrderItem[], sign: 1 | -1) {
  for (const i of items) {
    const flavor = db.products.find((p) => p.slug === i.slug)?.flavors.find((f) => f.name === i.flavor);
    if (!flavor) continue;
    // Ex.: PIX pago depois de expirar, com o sabor já vendido para outro cliente.
    if (flavor.stock + sign * i.qty < 0) console.warn(`[estoque] ${i.name} (${i.flavor}) vendido acima do estoque`);
    flavor.stock = Math.max(0, flavor.stock + sign * i.qty);
  }
}
