import "server-only";
import { randomUUID } from "crypto";
import { query, transaction, type Schema } from "./db";
import { EMAIL_RE, isCpf } from "./validation";
import { brl, onlyDigits } from "./format";
import { MAX_INSTALLMENTS, maxInstallmentsFor, paymentFee } from "./payment-fees";
import { createCardOrder, createPixOrder, getMpOrder, mpConfigured, rejectionMessage, undoMpOrder, type CardInput, type MpOrder } from "./mercadopago";
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

type CartLine = { slug: string; flavor: string; qty: number };
type CreateInput = {
  items: CartLine[];
  contact: unknown;
  address: unknown;
  method: "pix" | "card";
  card?: unknown;
  expectedTotal?: number; // total mostrado no checkout
};

// O PIX do Mercado Pago aceita validade a partir de 30 minutos.
const PIX_MINUTES = 30;

function parseContact(raw: unknown): Contact & { email: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const phone = onlyDigits(String(b.phone ?? ""));
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 120);
  if (name.length < 2) throw new OrderError("Informe seu nome");
  if (phone.length !== 10 && phone.length !== 11) throw new OrderError("Informe um WhatsApp válido com DDD");
  if (!EMAIL_RE.test(email)) throw new OrderError("Informe um e-mail válido");
  return { name, phone, email };
}

// O cartão chega tokenizado pelo Mercado Pago no navegador: aqui só o token, o CPF e o final do número.
function parseCard(raw: unknown): CardInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const token = String(b.token ?? "");
  const paymentMethodId = String(b.paymentMethodId ?? "");
  const last4 = String(b.last4 ?? "");
  const cpf = onlyDigits(String(b.cpf ?? ""));
  const installments = Math.floor(Number(b.installments));
  if (!/^[\w-]{8,100}$/.test(token) || !/^[a-z_]{2,30}$/.test(paymentMethodId)) throw new OrderError("Confira os dados do cartão");
  if (!isCpf(cpf)) throw new OrderError("CPF do titular inválido");
  if (!(installments >= 1 && installments <= MAX_INSTALLMENTS)) throw new OrderError("Número de parcelas inválido");
  return { token, paymentMethodId, installments, cpf, last4: /^\d{4}$/.test(last4) ? last4 : "" };
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

const BRANDS: Record<string, string> = { visa: "Visa", master: "Mastercard", amex: "Amex", elo: "Elo", hipercard: "Hipercard", cabal: "Cabal" };
const brandLabel = (id?: string) => (id ? (BRANDS[id] ?? id[0].toUpperCase() + id.slice(1)) : "Cartão");

// Falha na API do Mercado Pago (fora do ar, token do cartão vencido…).
function paymentError(e: unknown): never {
  if (e instanceof OrderError) throw e;
  console.error("[mercadopago] erro ao criar pagamento", e);
  throw new OrderError("Não foi possível processar o pagamento agora. Tente novamente em instantes.", 502);
}

// customerId só existe quando o cliente está logado (a conta é opcional).
export async function createOrder(customerId: string | null, input: CreateInput) {
  if (!mpConfigured) throw new OrderError("Pagamentos indisponíveis no momento. Fale com a loja pelo WhatsApp.", 503);
  if (!Array.isArray(input?.items) || input.items.length === 0) throw new OrderError("Carrinho vazio");
  const contact = parseContact(input.contact);
  if (input.method !== "pix" && input.method !== "card") throw new OrderError("Forma de pagamento inválida");
  const card = input.method === "card" ? parseCard(input.card) : null;

  if (!input.address) throw new OrderError("Informe o endereço de entrega");
  const address = parseAddress(input.address);
  if (!address.ok) throw new OrderError(Object.values(address.errors)[0]);

  // Rota calculada antes (chamadas externas são lentas).
  const estimate = sumItems(await query((db) => priceItems(db, input.items)));
  const { quote, point } = await quoteDelivery(address.data, estimate).catch((e) => {
    throw e instanceof DeliveryError ? new OrderError(e.message, e.status) : e;
  });

  // Preços, frete e taxa de pagamento de agora: é esse valor que vai para o Mercado Pago.
  const draft = await query((db) => {
    const items = priceItems(db, input.items);
    const subtotal = sumItems(items);
    const { surge, preorder } = deliveryTiming(db.delivery, db.settings);
    const delivery = deliveryFee(db.delivery.pricing, quote.distanceKm, quote.durationMin, subtotal, surge);
    const base = Math.round((subtotal + delivery.fee) * 100) / 100;
    if (card && card.installments > maxInstallmentsFor(db.paymentFees, base))
      throw new OrderError("Esse número de parcelas não está disponível para o valor do pedido");
    const charge = paymentFee(db.paymentFees, base, input.method, card?.installments);
    return { items, subtotal, delivery, preorder, paymentFee: charge.fee, total: charge.total };
  });
  // Preço, frete ou taxa mudaram desde que o cliente viu o total: não cobra um valor diferente,
  // nem por 1 centavo (a margem é só para a imprecisão do ponto flutuante).
  if (input.expectedTotal !== undefined && Math.abs(Number(input.expectedTotal) - draft.total) > 0.005)
    throw new OrderError(`O total do pedido foi atualizado para ${brl(draft.total)}. Confira o resumo e tente de novo.`, 409);

  const now = new Date();
  const at = now.toISOString();
  const id = randomUUID();
  const code = `BSP${now.getTime().toString(36).toUpperCase().slice(-6)}`;
  const extras = [
    { title: "Entrega", amount: draft.delivery.fee },
    { title: "Taxa de processamento", amount: draft.paymentFee },
  ];
  const charge = { orderId: id, code, total: draft.total, contact, items: draft.items, extras };

  let order: Order;
  const base = {
    id, code, ...(customerId && { customerId }), contact, items: draft.items, subtotal: draft.subtotal,
    address: { ...address.data, ...point }, delivery: draft.delivery, ...(draft.preorder && { preorder: draft.preorder }),
    ...(draft.paymentFee > 0 && { paymentFee: draft.paymentFee }), total: draft.total, createdAt: at,
  };
  if (card) {
    const result = await createCardOrder({ ...charge, card }).catch(paymentError);
    if (!result.approved) throw new OrderError(rejectionMessage(result.detail), 402);
    const { mp } = result;
    order = {
      ...base,
      payment: {
        method: "card", brand: brandLabel(card.paymentMethodId), last4: card.last4,
        installments: card.installments, mpId: mp.id, mpStatus: mp.status, paidAt: at,
      },
      status: "pago",
      history: [{ status: "aguardando_pagamento", at }, { status: "pago", at }],
    };
  } else {
    const mp = await createPixOrder({ ...charge, minutes: PIX_MINUTES }).catch(paymentError);
    const payment = mp.transactions?.payments?.[0];
    const pix = payment?.payment_method;
    if (!pix?.qr_code) paymentError(new Error(`PIX sem QR Code (order ${mp.id}, status ${mp.status})`));
    order = {
      ...base,
      payment: {
        method: "pix", pixCode: pix.qr_code, ticketUrl: pix.ticket_url,
        expiresAt: new Date(payment?.date_of_expiration ?? now.getTime() + PIX_MINUTES * 60_000).toISOString(), mpId: mp.id, mpStatus: mp.status,
      },
      status: "aguardando_pagamento",
      history: [{ status: "aguardando_pagamento", at }],
    };
  }

  try {
    return await transaction((db) => {
      // Guarda o endereço para preencher o próximo checkout.
      const customer = db.customers.find((c) => c.id === customerId);
      if (customer) customer.address = address.data;
      db.orders.push(order);
      return order;
    });
  } catch (e) {
    // Cobrado mas sem pedido gravado: devolve o dinheiro (cartão) ou cancela o PIX.
    console.error(`[mercadopago] pedido ${id} não foi gravado; desfazendo pagamento ${order.payment.mpId}`, e);
    await undoMpOrder(order.payment.mpId!, order.payment.method === "card").catch((err) =>
      console.error(`[mercadopago] FALHA ao desfazer o pagamento ${order.payment.mpId}: estorne pelo painel`, err),
    );
    throw e;
  }
}

function setStatus(order: Order, status: OrderStatus) {
  const at = new Date().toISOString();
  // Qualquer status a partir de "pago" implica pagamento confirmado.
  if (STATUS_FLOW.indexOf(status) >= STATUS_FLOW.indexOf("pago") && !order.payment.paidAt) order.payment.paidAt = at;
  order.status = status;
  order.history.push({ status, at });
}

// Aplica ao pedido o status da order no Mercado Pago (webhook ou consulta).
// A order é sempre lida da API, nunca do corpo da notificação.
export async function applyMpOrder(mp: MpOrder) {
  const id = mp.external_reference;
  const mpId = mp.id;
  const changed = (o: Order | undefined) => !!o && o.payment.mpId === mpId && o.payment.mpStatus !== mp.status;
  if (!id || !(await query((db) => changed(db.orders.find((o) => o.id === id))))) return;

  await transaction((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order || !changed(order)) return;
    order.payment.mpStatus = mp.status;
    if (mp.status === "processed") {
      if (Math.abs(Number(mp.total_paid_amount ?? 0) - order.total) > 0.01) {
        console.error(`[mercadopago] valor pago (${mp.total_paid_amount}) diferente do pedido ${order.code} (${order.total})`);
        return;
      }
      // Também vale para o PIX pago no último segundo, depois de expirar aqui.
      if (order.status === "aguardando_pagamento" || order.status === "cancelado") setStatus(order, "pago");
    } else if (["cancelled", "failed", "expired"].includes(mp.status ?? "")) {
      if (order.status === "aguardando_pagamento") setStatus(order, "cancelado");
    } else if (["refunded", "charged_back"].includes(mp.status ?? "")) {
      if (order.status !== "cancelado") setStatus(order, "cancelado");
    }
  });
}

// Confere no Mercado Pago um PIX ainda pendente (funciona mesmo sem webhook, ex.: em localhost).
export async function refreshPixPayment(order: Order) {
  if (order.payment.method !== "pix" || order.status !== "aguardando_pagamento" || !order.payment.mpId || !mpConfigured) return order;
  try {
    await applyMpOrder(await getMpOrder(order.payment.mpId));
  } catch (e) {
    console.error(`[mercadopago] não foi possível consultar a order ${order.payment.mpId}`, e);
    return order;
  }
  return (await getOrder(order.id)) ?? order;
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
