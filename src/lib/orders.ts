import "server-only";
import { randomUUID } from "crypto";
import { query, transaction, type Schema } from "./db";
import { cardBrand, luhn } from "./validation";
import { onlyDigits } from "./format";
import { deliveryFee, parseAddress } from "./delivery-pricing";
import { DeliveryError, deliveryTiming, quoteDelivery } from "./delivery";
import { STATUS_FLOW, STATUS_LABEL, type Contact, type Order, type OrderItem, type OrderStatus, type OrderSummary } from "./types";

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// PIX expirado sem pagamento → cancelado.
function expire(order: Order, now = Date.now()) {
  if (
    order.status === "aguardando_pagamento" &&
    order.payment.method === "pix" &&
    new Date(order.payment.expiresAt).getTime() < now
  ) {
    order.status = "cancelado";
    order.history.push({ status: "cancelado", at: order.payment.expiresAt });
    return true;
  }
  return false;
}

// Aplica expirações pendentes e grava, só quando algo mudou.
async function withExpirations<T>(read: (db: Schema) => T, ids: (db: Schema) => Order[]) {
  const needs = await query((db) => ids(db).some((o) => expire(structuredClone(o))));
  if (needs) await transaction((db) => void db.orders.forEach((o) => expire(o)));
  return query(read);
}

const byNewest = (a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt);

export function listOrders(customerId: string) {
  const mine = (db: Schema) => db.orders.filter((o) => o.customerId === customerId);
  return withExpirations((db) => mine(db).sort(byNewest), mine);
}

// O id (UUID) funciona como o link secreto do pedido: quem tem, acompanha.
export function getOrder(id: string) {
  const find = (db: Schema) => db.orders.filter((o) => o.id === id);
  return withExpirations((db) => find(db)[0] ?? null, find);
}

const orderPhone = (db: Schema, o: Order) => o.contact?.phone ?? db.customers.find((c) => c.id === o.customerId)?.phone;

// Pedidos de um WhatsApp, resumidos; `knownIds` são os pedidos feitos neste aparelho.
export function trackOrders(phone: string, knownIds: string[]) {
  const mine = (db: Schema) => db.orders.filter((o) => orderPhone(db, o) === phone);
  return withExpirations(
    (db) =>
      mine(db)
        .sort(byNewest)
        .map(
          (o): OrderSummary => ({
            ...(knownIds.includes(o.id) && { id: o.id }),
            code: o.code,
            status: o.status,
            total: o.total,
            createdAt: o.createdAt,
            preorder: o.preorder,
            items: o.items.map(({ name, flavor, qty, image }) => ({ name, flavor, qty, image })),
          }),
        ),
    mine,
  );
}

type CardInput = { number: string; name: string; expiry: string; cvv: string; installments: number };
type CartLine = { slug: string; flavor: string; qty: number };
type CreateInput = {
  items: CartLine[];
  contact: unknown;
  address: unknown;
  method: "pix" | "card" | "wallet";
  card?: CardInput;
  wallet?: unknown;
};

function parseContact(raw: unknown): Contact {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = onlyDigits(String(b.phone ?? ""));
  if (name.length < 2) throw new OrderError("Informe seu nome");
  if (phone.length !== 10 && phone.length !== 11) throw new OrderError("Informe um WhatsApp válido com DDD");
  return { name, phone };
}

// Preços sempre recalculados no servidor a partir do catálogo.
function priceItems(db: Schema, lines: CartLine[]): OrderItem[] {
  return lines.map((i) => {
    const p = db.products.find((x) => x.slug === i.slug && x.active);
    const qty = Math.floor(Number(i.qty));
    if (!p || !p.flavors.includes(i.flavor) || !(qty >= 1 && qty <= 20))
      throw new OrderError("Um item do carrinho não está mais disponível. Revise seu carrinho.");
    return { slug: p.slug, name: p.name, flavor: i.flavor, price: p.price, qty, image: p.image };
  });
}

const sumItems = (items: OrderItem[]) => items.reduce((s, i) => s + i.price * i.qty, 0);

function validateCard(card: CardInput | undefined) {
  if (!card) throw new OrderError("Dados do cartão ausentes");
  const number = onlyDigits(card.number ?? "");
  if (!luhn(number)) throw new OrderError("Número do cartão inválido");
  if (String(card.name ?? "").trim().length < 3) throw new OrderError("Nome impresso no cartão inválido");
  const [mm, yy] = String(card.expiry ?? "").split("/").map(Number);
  const expiry = new Date(2000 + yy, mm, 0, 23, 59);
  if (!mm || mm > 12 || !yy || expiry.getTime() < Date.now()) throw new OrderError("Validade inválida");
  if (!/^\d{3,4}$/.test(String(card.cvv ?? ""))) throw new OrderError("CVV inválido");
  const installments = Math.min(Math.max(Number(card.installments) || 1, 1), 3);
  // MOCK: cartões terminados em 0002 são recusados para testar o fluxo de erro.
  if (number.endsWith("0002")) throw new OrderError("Pagamento recusado pela operadora", 402);
  return { brand: cardBrand(number), last4: number.slice(-4), installments };
}

function mockPixCode(code: string, total: number) {
  const amount = total.toFixed(2);
  return `00020126580014BR.GOV.BCB.PIX0136bigsmokepods-mock-${code.toLowerCase()}52040000530398654${String(amount.length).padStart(2, "0")}${amount}5802BR5914BIG SMOKE PODS6009SAO PAULO62070503***6304MOCK`;
}

// customerId só existe quando o cliente está logado (a conta é opcional).
export async function createOrder(customerId: string | null, input: CreateInput) {
  if (!Array.isArray(input?.items) || input.items.length === 0) throw new OrderError("Carrinho vazio");
  const contact = parseContact(input.contact);
  const card = input.method === "card" ? validateCard(input.card) : null;
  // MOCK: Apple Pay / Google Pay aprovados na hora (no real viria do gateway).
  const wallet = input.method === "wallet" ? (input.wallet === "apple_pay" ? "apple_pay" : "google_pay") : null;
  if (!card && !wallet && input.method !== "pix") throw new OrderError("Forma de pagamento inválida");

  if (!input.address) throw new OrderError("Informe o endereço de entrega");
  const address = parseAddress(input.address);
  if (!address.ok) throw new OrderError(Object.values(address.errors)[0]);

  // Rota calculada fora da transação (chamadas externas são lentas).
  const estimate = sumItems(await query((db) => priceItems(db, input.items)));
  const { quote, point } = await quoteDelivery(address.data, estimate).catch((e) => {
    throw e instanceof DeliveryError ? new OrderError(e.message, e.status) : e;
  });

  return transaction((db) => {
    const items = priceItems(db, input.items);
    const subtotal = sumItems(items);
    const { surge, preorder } = deliveryTiming(db.delivery, db.settings);
    const delivery = deliveryFee(db.delivery.pricing, quote.distanceKm, quote.durationMin, subtotal, surge);
    const total = Math.round((subtotal + delivery.fee) * 100) / 100;
    const now = new Date();
    const at = now.toISOString();
    const code = `BSP${now.getTime().toString(36).toUpperCase().slice(-6)}`;
    const base = { id: randomUUID(), code, ...(customerId && { customerId }), contact, items, subtotal, address: { ...address.data, ...point }, delivery, ...(preorder && { preorder }), total, createdAt: at };

    // Guarda o endereço para preencher o próximo checkout.
    const customer = db.customers.find((c) => c.id === customerId);
    if (customer) customer.address = address.data;

    const paid = { status: "pago" as const, history: [{ status: "aguardando_pagamento" as const, at }, { status: "pago" as const, at }] };
    const order: Order = card
      ? { ...base, payment: { method: "card", ...card, paidAt: at }, ...paid }
      : wallet
        ? { ...base, payment: { method: "wallet", wallet, paidAt: at }, ...paid }
        : {
          ...base,
          payment: { method: "pix", pixCode: mockPixCode(code, total), expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString() },
          status: "aguardando_pagamento",
          history: [{ status: "aguardando_pagamento", at }],
        };
    db.orders.push(order);
    return order;
  });
}

function setStatus(order: Order, status: OrderStatus) {
  const at = new Date().toISOString();
  // Qualquer status a partir de "pago" implica pagamento confirmado.
  if (STATUS_FLOW.indexOf(status) >= STATUS_FLOW.indexOf("pago") && !order.payment.paidAt) order.payment.paidAt = at;
  order.status = status;
  order.history.push({ status, at });
}

// MOCK: simula a confirmação do PIX (no real viria de um webhook do PSP).
export async function confirmPix(id: string) {
  return transaction((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new OrderError("Pedido não encontrado", 404);
    expire(order);
    if (order.payment.method !== "pix" || order.status !== "aguardando_pagamento")
      throw new OrderError("Este pedido não aguarda pagamento PIX", 409);
    setStatus(order, "pago");
    return order;
  });
}

// ---- Admin ----

export type AdminOrder = Order & { customer: { name: string; email: string; phone: string; instagram: string } | null };

// Dados de quem recebe: o contato do pedido, completado pela conta (se houver).
function withCustomer(db: Schema, o: Order): AdminOrder {
  const c = db.customers.find((x) => x.id === o.customerId);
  if (!c && !o.contact) return { ...o, customer: null };
  return {
    ...o,
    customer: { name: o.contact?.name ?? c!.name, phone: o.contact?.phone ?? c!.phone, email: c?.email ?? "", instagram: c?.instagram ?? "" },
  };
}

export function adminListOrders() {
  return withExpirations(
    (db) => [...db.orders].sort(byNewest).map((o) => withCustomer(db, o)),
    (db) => db.orders,
  );
}

export function adminGetOrder(id: string) {
  const find = (db: Schema) => db.orders.filter((o) => o.id === id);
  return withExpirations((db) => {
    const o = find(db)[0];
    return o ? withCustomer(db, o) : null;
  }, find);
}

// Aceita só links https (ex.: o "compartilhar viagem" do app da Uber).
function parseTrackingUrl(raw: unknown) {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && value.length <= 500) return url.toString();
  } catch {}
  throw new OrderError("Link de acompanhamento inválido (precisa começar com https://)");
}

export async function adminUpdateOrder(id: string, input: { status?: OrderStatus; trackingUrl?: unknown }) {
  if (input.status !== undefined && !(input.status in STATUS_LABEL)) throw new OrderError("Status inválido");
  const trackingUrl = input.trackingUrl === undefined ? null : parseTrackingUrl(input.trackingUrl);
  return transaction((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new OrderError("Pedido não encontrado", 404);
    if (trackingUrl !== null) order.trackingUrl = trackingUrl;
    if (input.status && order.status !== input.status) setStatus(order, input.status);
    return withCustomer(db, order);
  });
}

export function adminStats() {
  return withExpirations((db) => {
    const paid = db.orders.filter((o) => !["aguardando_pagamento", "cancelado"].includes(o.status));
    const today = new Date().toDateString();
    const isToday = (o: Order) => new Date(o.createdAt).toDateString() === today;
    const revenue = paid.reduce((s, o) => s + o.total, 0);

    // Faturamento dos últimos 7 dias
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const daily = days.map((d) => ({
      day: d.toISOString(),
      total: paid.filter((o) => new Date(o.createdAt).toDateString() === d.toDateString()).reduce((s, o) => s + o.total, 0),
    }));

    const top = new Map<string, { name: string; qty: number; total: number }>();
    for (const o of paid)
      for (const i of o.items) {
        const t = top.get(i.slug) ?? { name: i.name, qty: 0, total: 0 };
        t.qty += i.qty;
        t.total += i.qty * i.price;
        top.set(i.slug, t);
      }

    return {
      revenue,
      paidOrders: paid.length,
      ticket: paid.length ? revenue / paid.length : 0,
      ordersToday: db.orders.filter(isToday).length,
      revenueToday: paid.filter(isToday).reduce((s, o) => s + o.total, 0),
      awaitingPayment: db.orders.filter((o) => o.status === "aguardando_pagamento").length,
      toShip: db.orders.filter((o) => ["pago", "em_separacao"].includes(o.status)).length,
      customers: new Set([...db.customers.map((c) => c.phone), ...db.orders.flatMap((o) => (o.contact ? [o.contact.phone] : []))]).size,
      activeProducts: db.products.filter((p) => p.active).length,
      daily,
      topProducts: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
      recent: [...db.orders].sort(byNewest).slice(0, 6).map((o) => withCustomer(db, o)),
    };
  }, (db) => db.orders);
}

// Clientes com conta + quem comprou sem conta (agrupado pelo WhatsApp).
export function adminListCustomers() {
  return query((db) => {
    const summary = (orders: Order[]) => {
      const paid = orders.filter((o) => !["aguardando_pagamento", "cancelado"].includes(o.status));
      return {
        orders: orders.length,
        spent: paid.reduce((s, o) => s + o.total, 0),
        lastOrderAt: orders.map((o) => o.createdAt).sort().at(-1) ?? null,
      };
    };
    const accounts = db.customers.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone, instagram: c.instagram, createdAt: c.createdAt, guest: false,
      ...summary(db.orders.filter((o) => o.customerId === c.id)),
    }));
    const guests = new Map<string, Order[]>();
    for (const o of db.orders)
      if (!o.customerId && o.contact) guests.set(o.contact.phone, [...(guests.get(o.contact.phone) ?? []), o]);
    const guestRows = [...guests].map(([phone, orders]) => {
      const sorted = [...orders].sort(byNewest);
      return {
        id: `guest-${phone}`, name: sorted[0].contact!.name, email: "", phone, instagram: "", createdAt: sorted.at(-1)!.createdAt, guest: true,
        ...summary(orders),
      };
    });
    return [...accounts, ...guestRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}
