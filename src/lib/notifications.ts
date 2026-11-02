import "server-only";
import { query } from "./db";
import { brl, formatPhone } from "./format";
import { formatAddress } from "./delivery-pricing";
import { formatOpening } from "./hours";
import { SITE, whatsappLink } from "./site";
import { sendText, waNumber, whatsappConfigured } from "./whatsapp";
import type { Order } from "./types";

// Mensagens de WhatsApp da loja: aviso de pedido pago para a equipe, e para o cliente
// o "saiu para entrega" (com o link da corrida) e o "combine a retirada".

const isPickup = (o: Order) => o.fulfillment === "pickup";

const paymentText = (o: Order) =>
  o.payment.method === "pix" ? "PIX" : o.payment.method === "card" ? `Cartão ${o.payment.installments}x` : "Carteira digital";

// Um número com problema não impede o envio para os outros.
async function sendAll(phones: string[], send: (phone: string) => Promise<unknown>) {
  const results = await Promise.allSettled(phones.map(send));
  results.forEach((r, i) => r.status === "rejected" && console.error(`[whatsapp] falha ao enviar para ${phones[i]}`, r.reason));
}

async function context(order: Order) {
  return query((db) => {
    const customer = db.customers.find((c) => c.id === order.customerId);
    return {
      team: db.settings.teamPhones ?? [],
      storeWhatsapp: db.settings.social.whatsapp,
      name: order.contact?.name ?? customer?.name ?? "Cliente",
      phone: order.contact?.phone ?? customer?.phone ?? "",
    };
  });
}

export function paidMessage(order: Order, name: string, phone: string) {
  const lines = [
    `🟢 *Novo pedido pago* — #${order.code}`,
    isPickup(order) ? "🏪 *Retirada no local*" : "🛵 Entrega por motoboy",
    ...(order.preorder ? [`⏰ Encomenda (loja fechada)${order.preorder.opensAt ? `: enviar a partir de ${formatOpening(order.preorder.opensAt)}` : ""}`] : []),
    "",
    `👤 ${name}`,
    `📱 ${formatPhone(phone)}`,
    "",
    ...order.items.map((i) => `${i.qty}x ${i.name} (${i.flavor}) — ${brl(i.price * i.qty)}`),
    "",
    ...(order.subtotal !== undefined ? [`Subtotal: ${brl(order.subtotal)}`] : []),
    ...(order.coupon
      ? [order.coupon.kind === "percent" ? `Cupom ${order.coupon.code}: −${brl(order.coupon.discount)}` : `Cupom ${order.coupon.code}: frete grátis`]
      : []),
    ...(order.delivery ? [`Entrega: ${order.delivery.free ? "grátis" : brl(order.delivery.fee)}`] : []),
    ...(order.paymentFee ? [`Taxa de processamento: ${brl(order.paymentFee)}`] : []),
    `*Total: ${brl(order.total)}* (${paymentText(order)})`,
    ...(isPickup(order) ? ["", "O cliente foi orientado a chamar a loja no WhatsApp para combinar a retirada."] : []),
  ];
  return lines.join("\n");
}

// Comando pronto para copiar: é só colar o link da corrida no fim e enviar.
export const rasTemplate = (order: Order) => `/ras - ${order.code} - `;

// Equipe: o pedido e, em mensagens separadas (para copiar), o endereço e o comando de despacho.
export async function notifyOrderPaid(order: Order) {
  if (!whatsappConfigured) return;
  const ctx = await context(order);
  const text = paidMessage(order, ctx.name, ctx.phone);
  const address = !isPickup(order) && order.address ? formatAddress(order.address) : null;
  await sendAll(ctx.team, async (phone) => {
    await sendText(phone, text);
    if (address) await sendText(phone, address);
    if (!isPickup(order)) await sendText(phone, rasTemplate(order));
  });
  // Retirada: o cliente recebe o caminho para combinar com a loja.
  if (isPickup(order) && ctx.phone) {
    const link = whatsappLink(ctx.storeWhatsapp, `Olá! Quero combinar a retirada do pedido #${order.code}.`);
    await sendText(
      waNumber(ctx.phone),
      `✅ Pagamento confirmado! Pedido *#${order.code}* — ${SITE.name}\n\nVocê escolheu *retirar no local*. Chame a gente no WhatsApp para combinar a retirada:\n${link}`,
    );
  }
}

export const shippedMessage = (order: Order) =>
  [
    `🛵 Seu pedido *#${order.code}* saiu para entrega!`,
    ...(order.trackingUrl ? [`Acompanhe a corrida: ${order.trackingUrl}`] : []),
    "",
    SITE.name,
  ].join("\n");

// Cliente: pedido a caminho, com o link da corrida. Retirada não tem esse aviso.
export async function notifyShipped(order: Order) {
  if (!whatsappConfigured || isPickup(order)) return false;
  const { phone } = await context(order);
  if (!phone) return false;
  await sendText(waNumber(phone), shippedMessage(order));
  return true;
}

// Equipe, menos quem fez a ação.
export async function notifyTeam(text: string, except?: (phone: string) => boolean) {
  if (!whatsappConfigured) return;
  const team = await query((db) => db.settings.teamPhones ?? []);
  await sendAll(team.filter((p) => !except?.(p)), (p) => sendText(p, text));
}
