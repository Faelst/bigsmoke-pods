import "server-only";
import { randomUUID } from "crypto";
import { query, transaction, type Schema } from "./db";
import { couponUse } from "./coupons";
import { cancelPreapproval, createPreapproval, findInvoiceByPayment, getInvoice, getMpPayment, getPreapproval, listInvoices, mpConfigured } from "./mercadopago";
import type { Customer, SubscriberBenefit, Subscription, SubscriptionCycle, SubscriptionPlan, SubscriptionView } from "./types";

// Assinatura mensal: o Mercado Pago cobra o cartão todo mês (preapproval) e cada mensalidade
// paga abre um ciclo de 1 mês com o pod do mês e o desconto do 2º pod.
//
// Travas contra "assinar, pedir e cancelar":
// - os benefícios só valem com a mensalidade paga (a 1ª cobrança não é na hora) e somem se ela for estornada;
// - um pod do mês e um 2º pod com desconto por mensalidade paga, sem acumular para o mês seguinte;
// - fidelidade: cancelar pelo site só depois de `minMonths` mensalidades pagas (valor de quando assinou);
// - cancelar não devolve a mensalidade, só interrompe as próximas (os benefícios seguem até o fim do ciclo);
// - uma assinatura por conta, e nova assinatura só depois que a anterior acabar de vez.

export class SubscriptionError extends Error {
  constructor(message: string, public status = 400, public errors?: Record<string, string>) {
    super(message);
  }
}

const REVERSED = ["refunded", "charged_back", "cancelled", "canceled"];
const CANCELLED = ["cancelled", "canceled"];

const addMonth = (iso: string) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
};

const paidCycles = (s: Subscription) => s.cycles.filter((c) => !c.reversed);

// Ciclo pago em vigor agora (o mais recente, se dois se sobrepõem por um dia).
function activeCycle(s: Subscription, now: number): SubscriptionCycle | null {
  return paidCycles(s).filter((c) => new Date(c.paidAt).getTime() <= now && now < new Date(c.endsAt).getTime()).sort((a, b) => b.paidAt.localeCompare(a.paidAt))[0] ?? null;
}

// A assinatura que conta para a conta: a mais recente.
const currentOf = (db: Schema, customerId: string) =>
  db.subscriptions.filter((s) => s.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

// Ainda em jogo: não cancelada, ou cancelada com ciclo pago em vigor.
const isLive = (s: Subscription, now: number) => s.status !== "cancelada" || !!activeCycle(s, now);

// O que o assinante ainda pode usar agora. Como no cupom, o uso é contado pelos pedidos:
// PIX no prazo reserva, pedido pago usa de vez, cancelado ou PIX expirado libera.
export function benefitFor(db: Schema, customerId: string | null | undefined, now = Date.now()): SubscriberBenefit | null {
  if (!customerId) return null;
  const sub = currentOf(db, customerId);
  const cycle = sub && activeCycle(sub, now);
  if (!sub || !cycle) return null;
  let freePod = true;
  let secondPod = true;
  for (const o of db.orders) {
    if (o.subscription?.id !== sub.id || o.subscription.cycle !== cycle.id || !couponUse(o, now)) continue;
    if (o.subscription.freePod > 0) freePod = false;
    if (o.subscription.secondPod > 0) secondPod = false;
  }
  const { podLimit, secondPodPercent } = db.subscriptionPlan;
  return { subscriptionId: sub.id, cycle: cycle.id, endsAt: cycle.endsAt, freePod, secondPod: secondPod && secondPodPercent > 0, podLimit, percent: secondPodPercent };
}

function view(db: Schema, sub: Subscription, now = Date.now()): SubscriptionView {
  const paidMonths = paidCycles(sub).length;
  // Antes da 1ª cobrança ainda dá para desistir; depois dela vale a fidelidade.
  const cancelAfterMonths = paidMonths === 0 ? 0 : Math.max(0, sub.minMonths - paidMonths);
  return {
    status: sub.status,
    price: sub.price,
    card: sub.card,
    createdAt: sub.createdAt,
    nextChargeAt: sub.status === "cancelada" ? undefined : sub.nextChargeAt,
    paidMonths,
    benefit: benefitFor(db, sub.customerId, now),
    canCancel: sub.status !== "cancelada" && cancelAfterMonths === 0,
    cancelAfterMonths,
  };
}

// Lê a assinatura e as faturas no Mercado Pago e atualiza a cópia da loja.
// A fonte é sempre a API, nunca o corpo de uma notificação.
export async function syncSubscription(mpId: string) {
  const known = await query((db) => db.subscriptions.find((s) => s.mpId === mpId));
  if (!known) return null;
  const [mp, invoices] = await Promise.all([getPreapproval(mpId), listInvoices(mpId)]);
  // A fatura nem sempre reflete um estorno feito depois: o pagamento do ciclo mais recente é conferido direto.
  const latest = [...invoices].filter((i) => i.payment?.id).sort((a, b) => (b.date_created ?? "").localeCompare(a.date_created ?? ""))[0];
  const latestStatus = latest ? await getMpPayment(String(latest.payment!.id)).then((p) => p.status, () => undefined) : undefined;

  return transaction((db) => {
    const sub = db.subscriptions.find((s) => s.mpId === mpId);
    if (!sub) return null;
    const now = new Date();
    for (const inv of invoices) {
      if (!inv.id || !inv.payment) continue;
      const status = (inv === latest && latestStatus) || inv.payment.status;
      const cycle = sub.cycles.find((c) => c.id === String(inv.id));
      if (cycle) {
        if (REVERSED.includes(status)) cycle.reversed = true;
        else if (status === "approved") delete cycle.reversed;
      } else if (status === "approved") {
        // O mês conta de quando a loja fica sabendo do pagamento (em geral, minutos depois dele).
        const paidAt = now.toISOString();
        sub.cycles.push({ id: String(inv.id), paidAt, endsAt: addMonth(paidAt), amount: Number(inv.transaction_amount ?? sub.price) });
      }
    }
    sub.mpStatus = mp.status;
    sub.nextChargeAt = mp.next_payment_date ? new Date(mp.next_payment_date).toISOString() : undefined;
    sub.syncedAt = now.toISOString();
    const active = !!activeCycle(sub, now.getTime());
    const failed = invoices.some((i) => i.payment && !["approved", "pending", "in_process", "authorized"].includes(i.payment.status));
    const before = sub.status;
    if (CANCELLED.includes(mp.status ?? "")) sub.status = "cancelada";
    else if (mp.status === "authorized" && active) sub.status = "ativa";
    else if (mp.status === "authorized" && sub.cycles.length === 0 && !failed) sub.status = "pendente";
    else sub.status = "suspensa";
    if (sub.status === "cancelada" && before !== "cancelada" && !sub.cancelledAt) {
      sub.cancelledAt = now.toISOString();
      sub.cancelledBy = "mercadopago";
    }
    return structuredClone(sub);
  });
}

// Notificação de fatura ou de pagamento: acha a assinatura e sincroniza.
export async function syncByInvoice(invoiceId: string) {
  const invoice = await getInvoice(invoiceId);
  if (invoice.preapproval_id) await syncSubscription(invoice.preapproval_id);
}

export async function syncByPayment(paymentId: string) {
  if (!/^\d+$/.test(paymentId)) return;
  const invoice = await findInvoiceByPayment(paymentId);
  if (invoice?.preapproval_id) await syncSubscription(invoice.preapproval_id);
}

// Vale conferir no Mercado Pago: 1ª cobrança pendente, mensalidade atrasada, cobrança prevista já passou
// ou a cópia está velha. Assim funciona mesmo sem webhook (ex.: localhost).
function stale(sub: Subscription, now: number) {
  if (sub.status === "cancelada") return false;
  const age = now - new Date(sub.syncedAt ?? 0).getTime();
  if (sub.status === "pendente" || sub.status === "suspensa") return age > 20_000;
  if (sub.nextChargeAt && new Date(sub.nextChargeAt).getTime() < now) return age > 60_000;
  return age > 6 * 3_600_000;
}

async function refreshed(customerId: string) {
  const sub = await query((db) => currentOf(db, customerId));
  if (!sub || !mpConfigured || !stale(sub, Date.now())) return;
  await syncSubscription(sub.mpId).catch((e) => console.error(`[assinatura] não foi possível consultar ${sub.mpId}`, e));
}

export const getPlan = () => query((db) => db.subscriptionPlan);

// Para /assinatura e o checkout. Assinatura encerrada de vez (cancelada e sem ciclo) some: pode assinar de novo.
export async function mySubscription(customerId: string | null) {
  if (customerId) await refreshed(customerId);
  return query((db) => {
    const sub = customerId ? currentOf(db, customerId) : null;
    return { plan: db.subscriptionPlan, subscription: sub && isLive(sub, Date.now()) ? view(db, sub) : null };
  });
}

// O cartão chega tokenizado pelo Mercado Pago no navegador.
function parseCard(raw: unknown) {
  const b = (raw ?? {}) as Record<string, unknown>;
  const token = String(b.token ?? "");
  const paymentMethodId = String(b.paymentMethodId ?? "");
  const last4 = String(b.last4 ?? "");
  if (!/^[\w-]{8,100}$/.test(token) || !/^[a-z_]{2,30}$/.test(paymentMethodId)) throw new SubscriptionError("Confira os dados do cartão");
  return { token, brand: paymentMethodId[0].toUpperCase() + paymentMethodId.slice(1), last4: /^\d{4}$/.test(last4) ? last4 : "" };
}

const blockedReason = (db: Schema, customerId: string) => {
  if (!db.subscriptionPlan.enabled) return "A assinatura não está disponível no momento.";
  const cur = currentOf(db, customerId);
  if (cur && isLive(cur, Date.now()))
    return cur.status === "cancelada" ? "Sua assinatura cancelada ainda vale até o fim do mês pago. Depois disso você pode assinar de novo." : "Você já tem uma assinatura.";
  return null;
};

// expectedPrice: a mensalidade que o cliente viu. backUrl: para onde o Mercado Pago aponta o "voltar".
export async function subscribe(customer: Customer, input: { card?: unknown; expectedPrice?: unknown; accepted?: unknown }, backUrl: string) {
  if (!mpConfigured) throw new SubscriptionError("Pagamentos indisponíveis no momento. Fale com a loja pelo WhatsApp.", 503);
  if (input?.accepted !== true) throw new SubscriptionError("Aceite as regras da assinatura para continuar");
  const card = parseCard(input.card);
  const plan = await query((db) => {
    const reason = blockedReason(db, customer.id);
    if (reason) throw new SubscriptionError(reason, 409);
    return db.subscriptionPlan;
  });
  if (Math.abs(Number(input.expectedPrice) - plan.price) > 0.005) throw new SubscriptionError("O valor da assinatura foi atualizado. Confira e tente de novo.", 409);

  const id = randomUUID();
  let mp;
  try {
    mp = await createPreapproval({ id, email: customer.email, token: card.token, amount: plan.price, backUrl });
  } catch (e) {
    console.error("[assinatura] erro ao criar no Mercado Pago", e);
    throw new SubscriptionError("Não foi possível ativar a assinatura com este cartão. Confira os dados ou tente outro cartão.", 402);
  }
  if (!mp.id || mp.status !== "authorized") {
    if (mp.id) await cancelPreapproval(mp.id).catch(() => {});
    throw new SubscriptionError("O cartão não foi autorizado para cobrança recorrente. Tente outro cartão.", 402);
  }
  const at = new Date().toISOString();
  const sub: Subscription = {
    id, customerId: customer.id, mpId: mp.id, mpStatus: mp.status, status: "pendente", price: plan.price, minMonths: plan.minMonths,
    card: { brand: card.brand, last4: card.last4 }, cycles: [], createdAt: at,
    ...(mp.next_payment_date && { nextChargeAt: new Date(mp.next_payment_date).toISOString() }),
  };
  try {
    await transaction((db) => {
      // Dois envios ao mesmo tempo: só um fica.
      const reason = blockedReason(db, customer.id);
      if (reason) throw new SubscriptionError(reason, 409);
      db.subscriptions.push(sub);
    });
  } catch (e) {
    await cancelPreapproval(sub.mpId).catch((err) => console.error(`[assinatura] FALHA ao cancelar ${sub.mpId}: cancele pelo painel do Mercado Pago`, err));
    throw e;
  }
  return (await mySubscription(customer.id)).subscription;
}

async function cancel(sub: Subscription, by: NonNullable<Subscription["cancelledBy"]>) {
  if (!CANCELLED.includes(sub.mpStatus ?? "")) {
    try {
      await cancelPreapproval(sub.mpId);
    } catch (e) {
      console.error(`[assinatura] erro ao cancelar ${sub.mpId}`, e);
      throw new SubscriptionError("Não foi possível cancelar agora. Tente novamente em instantes.", 502);
    }
  }
  return transaction((db) => {
    const s = db.subscriptions.find((x) => x.id === sub.id)!;
    s.status = "cancelada";
    s.mpStatus = "cancelled";
    s.cancelledAt ??= new Date().toISOString();
    s.cancelledBy ??= by;
    return view(db, s);
  });
}

export async function cancelMine(customerId: string) {
  const sub = await query((db) => currentOf(db, customerId));
  if (!sub || sub.status === "cancelada") throw new SubscriptionError("Você não tem assinatura ativa", 404);
  const left = sub.minMonths - paidCycles(sub).length;
  if (paidCycles(sub).length > 0 && left > 0)
    throw new SubscriptionError(
      `A assinatura tem fidelidade de ${sub.minMonths} mensalidades. Falta${left > 1 ? "m" : ""} ${left} para cancelar pelo site. Se precisar, fale com a loja pelo WhatsApp.`,
      409,
    );
  return cancel(sub, "customer");
}

// ---- Admin ----

export type AdminSubscription = Subscription & { customer: { name: string; email: string; phone: string } | null; paidMonths: number; benefit: SubscriberBenefit | null };

const adminRow = (db: Schema, s: Subscription): AdminSubscription => {
  const c = db.customers.find((x) => x.id === s.customerId);
  return { ...s, customer: c ? { name: c.name, email: c.email, phone: c.phone } : null, paidMonths: paidCycles(s).length, benefit: s === currentOf(db, s.customerId) ? benefitFor(db, s.customerId) : null };
};

export const adminListSubscriptions = () =>
  query((db) => ({
    plan: db.subscriptionPlan,
    subscriptions: [...db.subscriptions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((s) => adminRow(db, s)),
  }));

// O admin cancela a qualquer momento (a fidelidade só vale para o cancelamento pelo site).
export async function adminCancelSubscription(id: string) {
  const sub = await query((db) => db.subscriptions.find((s) => s.id === id));
  if (!sub) throw new SubscriptionError("Assinatura não encontrada", 404);
  if (sub.status !== "cancelada") await cancel(sub, "admin");
  return query((db) => adminRow(db, db.subscriptions.find((s) => s.id === id)!));
}

export async function adminSyncSubscription(id: string) {
  const sub = await query((db) => db.subscriptions.find((s) => s.id === id));
  if (!sub) throw new SubscriptionError("Assinatura não encontrada", 404);
  await syncSubscription(sub.mpId).catch((e) => {
    console.error(`[assinatura] erro ao consultar ${sub.mpId}`, e);
    throw new SubscriptionError("Não foi possível consultar o Mercado Pago agora.", 502);
  });
  return query((db) => adminRow(db, db.subscriptions.find((s) => s.id === id)!));
}

const num = (v: unknown) => Math.round(Number(String(v ?? "").trim().replace(",", ".")) * 100) / 100;

// Mudar a mensalidade vale para novas assinaturas; quem já assina segue no valor contratado.
export async function savePlan(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const price = num(b.price);
  const podLimit = num(b.podLimit);
  const secondPodPercent = num(b.secondPodPercent);
  const minMonths = Math.floor(num(b.minMonths));
  if (!(price >= 5 && price <= 10_000)) errors.price = "Informe a mensalidade (mínimo R$ 5,00)";
  if (!(podLimit > 0 && podLimit <= 10_000)) errors.podLimit = "Informe o valor máximo do pod do mês";
  if (!(secondPodPercent >= 0 && secondPodPercent <= 90)) errors.secondPodPercent = "Use uma porcentagem entre 0 e 90";
  if (!(minMonths >= 0 && minMonths <= 24)) errors.minMonths = "Use de 0 a 24 meses";
  if (Object.keys(errors).length) throw new SubscriptionError("Confira os campos", 400, errors);
  const plan: SubscriptionPlan = { enabled: b.enabled === true, price, podLimit, secondPodPercent, minMonths };
  return transaction((db) => (db.subscriptionPlan = plan));
}
