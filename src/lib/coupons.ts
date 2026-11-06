import "server-only";
import { randomUUID } from "crypto";
import { query, transaction, type Schema } from "./db";
import { onlyDigits } from "./format";
import { todayInStore } from "./hours";
import type { AdminCoupon, Coupon, CouponKind, CouponOffer, Order } from "./types";

export class CouponError extends Error {
  constructor(message: string, public status = 400, public errors?: Record<string, string>) {
    super(message);
  }
}

export const normalizeCode = (raw: unknown) => String(raw ?? "").trim().toUpperCase().slice(0, 30);

// Cliente = número de WhatsApp do pedido (só dígitos, sem o 55).
export const normalizePhone = (raw: unknown) => onlyDigits(String(raw ?? "")).replace(/^55(?=\d{10,11}$)/, "");
const orderPhone = (db: Schema, o: Order) => normalizePhone(o.contact?.phone ?? db.customers.find((c) => c.id === o.customerId)?.phone);

// Como o estoque: PIX no prazo reserva o uso, pedido pago (ou além) usa de vez,
// cancelado ou PIX expirado não conta.
function couponUse(o: Order, now: number): "reserved" | "used" | null {
  if (o.status === "cancelado") return null;
  if (o.status !== "aguardando_pagamento") return "used";
  return o.payment.method === "pix" && new Date(o.payment.expiresAt).getTime() > now ? "reserved" : null;
}

function usage(db: Schema, couponId: string, phone?: string, now = Date.now()) {
  let used = 0, reserved = 0, byPhone = 0;
  for (const o of db.orders) {
    if (o.coupon?.id !== couponId) continue;
    const s = couponUse(o, now);
    if (!s) continue;
    if (s === "used") used++;
    else reserved++;
    if (phone && orderPhone(db, o) === phone) byPhone++;
  }
  return { used, reserved, total: used + reserved, byPhone };
}

// Já comprou: pedido pago (ou além) ou PIX ainda no prazo, com ou sem cupom.
// Quem comprou sem usar o cupom de primeira compra perde o direito a ele.
const hasPurchased = (db: Schema, phone: string, now: number) => db.orders.some((o) => couponUse(o, now) && orderPhone(db, o) === phone);

// Cupom que pode ser usado agora por esse WhatsApp (sem número, o limite por cliente fica para o pedido).
export function usableCoupon(db: Schema, rawCode: unknown, rawPhone?: unknown, now = new Date()): Coupon {
  const code = normalizeCode(rawCode);
  const coupon = db.coupons.find((c) => c.code === code);
  if (!code || !coupon || !coupon.active) throw new CouponError("Cupom inválido");
  if (todayInStore(now) > coupon.validUntil) throw new CouponError("Este cupom expirou");
  const phone = normalizePhone(rawPhone);
  const known = phone.length >= 10 ? phone : undefined;
  const u = usage(db, coupon.id, known, now.getTime());
  if (coupon.maxUses > 0 && u.total >= coupon.maxUses) throw new CouponError("Este cupom esgotou");
  if (coupon.maxPerPhone > 0 && u.byPhone >= coupon.maxPerPhone)
    throw new CouponError(
      coupon.maxPerPhone === 1
        ? "Este WhatsApp já usou este cupom"
        : `Este cupom pode ser usado ${coupon.maxPerPhone} vezes por WhatsApp, e este número já usou todas`,
    );
  if (coupon.firstPurchaseOnly && known && hasPurchased(db, known, now.getTime()))
    throw new CouponError("Este cupom é só para a primeira compra, e este WhatsApp já comprou com a gente");
  return coupon;
}

export const toOffer = (c: Coupon): CouponOffer => ({
  code: c.code,
  kind: c.kind,
  ...(c.kind === "percent" && { percent: c.percent }),
  ...(c.kind === "fixed" && { amount: c.amount }),
});

// Checkout: confere o código antes de aplicar no resumo (o pedido confere de novo).
export const checkCoupon = (code: unknown, phone?: unknown) => query((db) => toOffer(usableCoupon(db, code, phone)));

// ---- Admin ----

const withUsage = (db: Schema, c: Coupon): AdminCoupon => {
  const { used, reserved } = usage(db, c.id);
  return { ...c, used, reserved };
};

export const adminListCoupons = () =>
  query((db) => [...db.coupons].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => withUsage(db, c)));

type CouponInput = Omit<Coupon, "id" | "createdAt">;

const KINDS: CouponKind[] = ["free_shipping", "percent", "fixed"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => DATE_RE.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

export function parseCoupon(body: unknown, partial = false): Partial<CouponInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const has = (k: string) => !partial || k in b;
  const out: Partial<CouponInput> = {};
  const errors: Record<string, string> = {};
  const count = (k: "maxUses" | "maxPerPhone") => {
    if (!has(k)) return;
    const raw = String(b[k] ?? "").trim();
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) errors[k] = "Use um número inteiro (0 = sem limite)";
    out[k] = n;
  };

  if (has("code")) {
    out.code = normalizeCode(b.code);
    if (!/^[A-Z0-9_-]{3,30}$/.test(out.code)) errors.code = "Use de 3 a 30 letras, números, - ou _ (sem espaços)";
  }
  if (has("kind")) {
    out.kind = b.kind as CouponKind;
    if (!KINDS.includes(out.kind)) errors.kind = "Escolha o tipo do cupom";
  }
  // A porcentagem só importa no cupom de desconto (no PATCH, updateCoupon confere o resultado).
  if (out.kind === "percent" || (partial && b.percent !== undefined && b.percent !== "")) {
    const n = Math.round(Number(String(b.percent ?? "").replace(",", ".")) * 100) / 100;
    if (!(n >= 1 && n <= 90)) errors.percent = "Informe uma porcentagem entre 1 e 90";
    out.percent = n;
  }
  if (out.kind === "fixed" || (partial && b.amount !== undefined && b.amount !== "")) {
    // "1.234,50" ou "10,50" (vírgula = centavos) e também "10.50".
    const raw = String(b.amount ?? "").trim();
    const n = Math.round(Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw) * 100) / 100;
    if (!(n >= 1 && n <= 10_000)) errors.amount = "Informe um valor entre R$ 1,00 e R$ 10.000,00";
    out.amount = n;
  }
  if (has("validUntil")) {
    out.validUntil = String(b.validUntil ?? "");
    if (!validDate(out.validUntil)) errors.validUntil = "Informe a data de validade";
  }
  count("maxUses");
  count("maxPerPhone");
  if (has("firstPurchaseOnly")) out.firstPurchaseOnly = Boolean(b.firstPurchaseOnly);
  if (has("active")) out.active = b.active === undefined ? true : Boolean(b.active);

  if (Object.keys(errors).length) throw new CouponError("Confira os campos", 422, errors);
  return out;
}

function assertUniqueCode(db: Schema, code: string | undefined, id?: string) {
  if (code && db.coupons.some((c) => c.code === code && c.id !== id))
    throw new CouponError("Já existe um cupom com esse código", 409, { code: "Já existe um cupom com esse código" });
}

// Cada tipo guarda só o seu valor (porcentagem ou R$).
function tidy(c: Coupon) {
  if (c.kind !== "percent") delete c.percent;
  if (c.kind !== "fixed") delete c.amount;
  return c;
}

export function createCoupon(input: Partial<CouponInput>) {
  return transaction((db) => {
    assertUniqueCode(db, input.code);
    const coupon = tidy({ ...(input as CouponInput), id: randomUUID(), createdAt: new Date().toISOString() });
    db.coupons.push(coupon);
    return withUsage(db, coupon);
  });
}

// Os pedidos apontam para o id do cupom: trocar o código não zera a contagem de usos.
export function updateCoupon(id: string, input: Partial<CouponInput>) {
  return transaction((db) => {
    const coupon = db.coupons.find((c) => c.id === id);
    if (!coupon) throw new CouponError("Cupom não encontrado", 404);
    assertUniqueCode(db, input.code, id);
    const next = { ...coupon, ...input };
    if (next.kind === "percent" && !(next.percent! > 0))
      throw new CouponError("Confira os campos", 422, { percent: "Informe uma porcentagem entre 1 e 90" });
    if (next.kind === "fixed" && !(next.amount! > 0))
      throw new CouponError("Confira os campos", 422, { amount: "Informe o valor do desconto" });
    Object.assign(coupon, next);
    return withUsage(db, tidy(coupon));
  });
}

// Pedidos que já usaram o cupom guardam uma cópia (código, tipo e desconto).
export function deleteCoupon(id: string) {
  return transaction((db) => {
    db.coupons = db.coupons.filter((c) => c.id !== id);
  });
}
