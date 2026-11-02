import "server-only";
import { randomUUID } from "crypto";
import { query, transaction, type Schema } from "./db";
import { todayInStore } from "./hours";
import type { AdminCoupon, Coupon, CouponKind, CouponOffer, Order } from "./types";

export class CouponError extends Error {
  constructor(message: string, public status = 400, public errors?: Record<string, string>) {
    super(message);
  }
}

export const normalizeCode = (raw: unknown) => String(raw ?? "").trim().toUpperCase().slice(0, 30);

const orderEmail = (db: Schema, o: Order) => o.contact?.email ?? db.customers.find((c) => c.id === o.customerId)?.email ?? "";

// Como o estoque: PIX no prazo reserva o uso, pedido pago (ou além) usa de vez,
// cancelado ou PIX expirado não conta.
function couponUse(o: Order, now: number): "reserved" | "used" | null {
  if (o.status === "cancelado") return null;
  if (o.status !== "aguardando_pagamento") return "used";
  return o.payment.method === "pix" && new Date(o.payment.expiresAt).getTime() > now ? "reserved" : null;
}

function usage(db: Schema, couponId: string, email?: string, now = Date.now()) {
  let used = 0, reserved = 0, byEmail = 0;
  for (const o of db.orders) {
    if (o.coupon?.id !== couponId) continue;
    const s = couponUse(o, now);
    if (!s) continue;
    if (s === "used") used++;
    else reserved++;
    if (email && orderEmail(db, o) === email) byEmail++;
  }
  return { used, reserved, total: used + reserved, byEmail };
}

// Cupom que pode ser usado agora por esse e-mail (sem e-mail, o limite por cliente fica para o pedido).
export function usableCoupon(db: Schema, rawCode: unknown, email?: string, now = new Date()): Coupon {
  const code = normalizeCode(rawCode);
  const coupon = db.coupons.find((c) => c.code === code);
  if (!code || !coupon || !coupon.active) throw new CouponError("Cupom inválido");
  if (todayInStore(now) > coupon.validUntil) throw new CouponError("Este cupom expirou");
  const u = usage(db, coupon.id, email?.trim().toLowerCase(), now.getTime());
  if (coupon.maxUses > 0 && u.total >= coupon.maxUses) throw new CouponError("Este cupom esgotou");
  if (email && coupon.maxPerEmail > 0 && u.byEmail >= coupon.maxPerEmail)
    throw new CouponError(coupon.maxPerEmail === 1 ? "Você já usou este cupom" : `Este cupom pode ser usado ${coupon.maxPerEmail} vezes por cliente, e você já usou todas`);
  return coupon;
}

export const toOffer = (c: Coupon): CouponOffer => ({ code: c.code, kind: c.kind, ...(c.kind === "percent" && { percent: c.percent }) });

// Checkout: confere o código antes de aplicar no resumo (o pedido confere de novo).
export const checkCoupon = (code: unknown, email?: unknown) =>
  query((db) => toOffer(usableCoupon(db, code, typeof email === "string" && email ? email : undefined)));

// ---- Admin ----

const withUsage = (db: Schema, c: Coupon): AdminCoupon => {
  const { used, reserved } = usage(db, c.id);
  return { ...c, used, reserved };
};

export const adminListCoupons = () =>
  query((db) => [...db.coupons].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => withUsage(db, c)));

type CouponInput = Omit<Coupon, "id" | "createdAt">;

const KINDS: CouponKind[] = ["free_shipping", "percent"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => DATE_RE.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

export function parseCoupon(body: unknown, partial = false): Partial<CouponInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const has = (k: string) => !partial || k in b;
  const out: Partial<CouponInput> = {};
  const errors: Record<string, string> = {};
  const count = (k: "maxUses" | "maxPerEmail") => {
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
  if (has("validUntil")) {
    out.validUntil = String(b.validUntil ?? "");
    if (!validDate(out.validUntil)) errors.validUntil = "Informe a data de validade";
  }
  count("maxUses");
  count("maxPerEmail");
  if (has("active")) out.active = b.active === undefined ? true : Boolean(b.active);

  if (Object.keys(errors).length) throw new CouponError("Confira os campos", 422, errors);
  return out;
}

function assertUniqueCode(db: Schema, code: string | undefined, id?: string) {
  if (code && db.coupons.some((c) => c.code === code && c.id !== id))
    throw new CouponError("Já existe um cupom com esse código", 409, { code: "Já existe um cupom com esse código" });
}

// Frete grátis não guarda porcentagem.
function tidy(c: Coupon) {
  if (c.kind !== "percent") delete c.percent;
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
