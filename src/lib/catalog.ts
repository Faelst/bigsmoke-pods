import "server-only";
import { randomUUID } from "crypto";
import { query, transaction } from "./db";
import { slugify } from "./products";
import type { Product } from "./types";

export const listActiveProducts = () => query((db) => db.products.filter((p) => p.active));
export const listAllProducts = () =>
  query((db) => [...db.products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
export const getActiveProduct = (slug: string) =>
  query((db) => db.products.find((p) => p.slug === slug && p.active) ?? null);

export class ProductError extends Error {
  constructor(public errors: Record<string, string>, public status = 422) {
    super("product");
  }
}

type ProductInput = Omit<Product, "id" | "slug" | "createdAt">;

export function parseProduct(body: unknown, partial = false) {
  const b = (body ?? {}) as Record<string, unknown>;
  const out: Partial<ProductInput> = {};
  const errors: Record<string, string> = {};
  const has = (k: string) => k in b;
  const text = (k: keyof ProductInput, max: number, required = true) => {
    if (partial && !has(k)) return;
    const v = String(b[k] ?? "").trim().slice(0, max);
    if (required && !v) errors[k] = "Obrigatório";
    (out as Record<string, unknown>)[k] = v;
  };
  text("name", 80);
  text("brand", 40);
  text("puffs", 20, false);
  text("capacity", 20, false);
  text("description", 600, false);
  text("image", 300);
  text("badge", 24, false);
  if (!partial || has("price")) {
    const price = Math.round(Number(b.price) * 100) / 100;
    if (!(price > 0)) errors.price = "Preço inválido";
    out.price = price;
  }
  if (!partial || has("flavors")) {
    const list = Array.isArray(b.flavors) ? b.flavors : String(b.flavors ?? "").split(",");
    out.flavors = [...new Set(list.map((f) => String(f).trim()).filter(Boolean))].slice(0, 30);
    if (out.flavors.length === 0) errors.flavors = "Informe ao menos um sabor";
  }
  for (const k of ["bestseller", "isNew"] as const) if (!partial || has(k)) out[k] = b[k] === true;
  if (!partial || has("active")) out.active = b.active === undefined ? true : Boolean(b.active);
  if (out.image && !/^\/(products|api\/uploads)\//.test(out.image)) errors.image = "Imagem inválida";
  if (Object.keys(errors).length) throw new ProductError(errors);
  return out;
}

function uniqueSlug(products: Product[], name: string, ignoreId?: string) {
  const base = slugify(name) || "produto";
  let slug = base;
  for (let i = 2; products.some((p) => p.slug === slug && p.id !== ignoreId); i++) slug = `${base}-${i}`;
  return slug;
}

export function createProduct(input: Partial<ProductInput>) {
  return transaction((db) => {
    const p: Product = {
      ...(input as ProductInput),
      badge: input.badge || undefined,
      id: randomUUID(),
      slug: uniqueSlug(db.products, input.name!),
      createdAt: new Date().toISOString(),
    };
    db.products.push(p);
    return p;
  });
}

export function updateProduct(id: string, input: Partial<ProductInput>) {
  return transaction((db) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new ProductError({ id: "Produto não encontrado" }, 404);
    Object.assign(p, input);
    if (input.badge === "") delete p.badge;
    return p;
  });
}

export function deleteProduct(id: string) {
  return transaction((db) => {
    const before = db.products.length;
    db.products = db.products.filter((p) => p.id !== id);
    if (db.products.length === before) throw new ProductError({ id: "Produto não encontrado" }, 404);
  });
}
