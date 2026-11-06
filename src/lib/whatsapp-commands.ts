import "server-only";
import { query } from "./db";
import { notifyShipped, notifyTeam, notifyTracking, saiuTemplate } from "./notifications";
import { adminUpdateOrder, findOrderByCode, OrderError } from "./orders";
import { STATUS_LABEL, type Order, type OrderStatus } from "./types";
import { samePhone, sendText } from "./whatsapp";

// Comandos que a equipe manda para o WhatsApp da loja (webhook MESSAGES_UPSERT da Evolution API).
// Só números cadastrados em Loja → WhatsApp da equipe são atendidos; o resto é ignorado.
//   /ras - CÓDIGO - <mensagem de compartilhar viagem da Uber>: o motoboy aceitou a corrida.
//     O pedido vai para "Em separação" e o cliente recebe só o link.
//   /saiu - CÓDIGO: o motoboy retirou o pedido. Vai para "Saiu para entrega" e o cliente é avisado.

type Incoming = {
  key?: { remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean };
  pushName?: string;
  senderPn?: string;
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
};

const USAGE = [
  "Comandos:",
  "• /ras - CÓDIGO - mensagem da Uber com o link",
  "Ex.: /ras - BSP4K2X9 - Uma entrega de itens está a caminho! Acompanhe minha viagem do Uber Envios: https://trip.uber.com/...",
  "Marca o pedido como em separação e manda só o link para o cliente. A Uber cancelou? Mande o /ras de novo com o novo link.",
  "",
  "• /saiu - CÓDIGO",
  "Quando o motoboy retirar: marca como saiu para entrega e avisa o cliente.",
].join("\n");

const textOf = (m: Incoming) => (m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? "").trim();

// O WhatsApp pode identificar a conversa por um id interno (@lid); o número vem nos campos "alternativos".
const senderPhones = (m: Incoming) =>
  [m.key?.remoteJid, m.key?.remoteJidAlt, m.key?.senderPn, m.senderPn]
    .filter((j): j is string => !!j && /@s\.whatsapp\.net$/.test(j))
    .map((j) => j.split("@")[0].split(":")[0]);

// "/ras - BSP4K2X9 - <qualquer texto com o link>" (aceita também sem os traços ou com #).
// Do texto colado da Uber, só o primeiro link https vai para o pedido (e para o cliente).
export function parseRas(text: string) {
  const m = text.match(/^\/ras\b[\s\-–—:]*#?([A-Za-z0-9]+)([\s\S]*)$/i);
  const link = m?.[2].match(/https:\/\/\S+/i)?.[0].replace(/[.,;:!?)\]}>"'*_~]+$/, "");
  return m && link ? { code: m[1].toUpperCase(), link } : null;
}

// "/saiu - BSP4K2X9" (aceita também sem o traço ou com #).
export function parseSaiu(text: string) {
  const m = text.match(/^\/saiu\b[\s\-–—:]*#?([A-Za-z0-9]+)\s*$/i);
  return m ? { code: m[1].toUpperCase() } : null;
}

export async function handleIncoming(body: unknown) {
  const b = (body ?? {}) as { event?: string; data?: Incoming | Incoming[] };
  if (b.event && b.event.toLowerCase().replace("_", ".") !== "messages.upsert") return;
  const messages = Array.isArray(b.data) ? b.data : b.data ? [b.data] : [];
  for (const m of messages) {
    if (m.key?.fromMe || m.key?.remoteJid?.endsWith("@g.us")) continue;
    const text = textOf(m);
    if (!text.startsWith("/")) continue;
    const team = await query((db) => db.settings.teamPhones ?? []);
    const phones = senderPhones(m);
    const member = team.find((t) => phones.some((p) => samePhone(t, p)));
    if (!member) {
      console.warn(`[whatsapp] comando ignorado de número fora da equipe (${phones.join(", ") || m.key?.remoteJid})`);
      continue;
    }
    const reply = await runCommand(text, member, m.pushName);
    for (const r of [reply].flat()) await sendText(member, r);
  }
}

// Várias respostas = várias mensagens (ex.: o próximo comando, sozinho, para copiar).
type Reply = string | string[];

function runCommand(text: string, member: string, who?: string): Promise<Reply> | Reply {
  if (/^\/ras\b/i.test(text)) return ras(text, member, who);
  if (/^\/saiu\b/i.test(text)) return saiu(text, member, who);
  return `Comando não reconhecido.\n\n${USAGE}`;
}

// Pedido que não tem motoboy ou que já foi encerrado.
function blocked(order: Order | null, code: string): string | null {
  if (!order) return `❌ Pedido #${code} não encontrado. Confira o código.`;
  if (order.fulfillment === "pickup") return `❌ O pedido #${order.code} é *retirada no local*: não tem motoboy.`;
  if (order.status === "aguardando_pagamento") return `❌ O pedido #${order.code} ainda não foi pago.`;
  if (order.status === "cancelado" || order.status === "entregue")
    return `❌ O pedido #${order.code} está como "${STATUS_LABEL[order.status]}" e não pode mais ser despachado.`;
  return null;
}

// O aviso ao cliente sai pelo próprio comando, para responder se deu certo.
async function update(order: Order, input: { status?: OrderStatus; trackingUrl?: string }) {
  try {
    return await adminUpdateOrder(order.id, input, { notify: false });
  } catch (e) {
    if (e instanceof OrderError) return `❌ ${e.message}`;
    throw e;
  }
}

const tellCustomer = (send: Promise<boolean>, code: string) =>
  send.catch((e) => {
    console.error(`[whatsapp] falha ao avisar o cliente do pedido ${code}`, e);
    return false;
  });

// Resto da equipe, menos quem mandou o comando.
const tellTeam = (text: string, member: string, who?: string) =>
  notifyTeam(`${text}${who ? ` (por ${who})` : ""}.`, (p) => samePhone(p, member)).catch((e) => console.error("[whatsapp] falha ao avisar a equipe", e));

async function ras(text: string, member: string, who?: string): Promise<Reply> {
  const cmd = parseRas(text);
  if (!cmd) return `Não entendi o comando (faltou o código do pedido ou o link https da corrida).\n\n${USAGE}`;
  const order = await findOrderByCode(cmd.code);
  const error = blocked(order, cmd.code);
  if (error || !order) return error!;
  if (order.trackingUrl === cmd.link) return `O pedido #${order.code} já estava com esse link. Nada mudou.`;

  const relink = !!order.trackingUrl;
  // Já saiu para entrega (a Uber cancelou depois da retirada): só troca o link.
  const shipped = order.status === "saiu_para_entrega";
  const updated = await update(order, { status: shipped ? undefined : "em_separacao", trackingUrl: cmd.link });
  if (typeof updated === "string") return updated;
  const sent = await tellCustomer(notifyTracking(updated), order.code);
  await tellTeam(relink ? `🔁 Pedido #${order.code}: link da corrida trocado` : `🏍️ Pedido #${order.code}: motoboy aceitou a corrida`, member, who);
  const done = [
    relink ? `✅ Link da corrida do pedido #${order.code} trocado.` : `✅ Pedido #${order.code} marcado como *em separação*, com o link da corrida.`,
    sent ? "Cliente recebeu o link no WhatsApp." : "⚠️ Não consegui avisar o cliente pelo WhatsApp: envie o link pelo painel.",
  ];
  if (shipped) return done.join("\n");
  return [[...done, "", "Quando o motoboy retirar, envie o comando abaixo:"].join("\n"), saiuTemplate(updated)];
}

async function saiu(text: string, member: string, who?: string): Promise<Reply> {
  const cmd = parseSaiu(text);
  if (!cmd) return `Não entendi o comando.\n\n${USAGE}`;
  const order = await findOrderByCode(cmd.code);
  const error = blocked(order, cmd.code);
  if (error || !order) return error!;
  if (order.status === "saiu_para_entrega") return `O pedido #${order.code} já estava como saiu para entrega. Nada mudou.`;

  const updated = await update(order, { status: "saiu_para_entrega" });
  if (typeof updated === "string") return updated;
  const sent = await tellCustomer(notifyShipped(updated), order.code);
  await tellTeam(`🛵 Pedido #${order.code} saiu para entrega`, member, who);
  return [
    `✅ Pedido #${order.code} marcado como *saiu para entrega*.`,
    sent ? "Cliente avisado no WhatsApp." : "⚠️ Não consegui avisar o cliente pelo WhatsApp: avise pelo painel.",
    ...(!updated.trackingUrl ? ["", "Esse pedido está sem link da corrida. Para mandar o rastreio, use o /ras."] : []),
  ].join("\n");
}
