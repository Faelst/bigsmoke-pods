import "server-only";
import { query } from "./db";
import { notifyShipped, notifyTeam } from "./notifications";
import { adminUpdateOrder, findOrderByCode, OrderError } from "./orders";
import { STATUS_LABEL } from "./types";
import { samePhone, sendText } from "./whatsapp";

// Comandos que a equipe manda para o WhatsApp da loja (webhook MESSAGES_UPSERT da Evolution API).
// Só números cadastrados em Loja → WhatsApp da equipe são atendidos; o resto é ignorado.

type Incoming = {
  key?: { remoteJid?: string; remoteJidAlt?: string; senderPn?: string; fromMe?: boolean };
  pushName?: string;
  senderPn?: string;
  message?: { conversation?: string; extendedTextMessage?: { text?: string } };
};

const USAGE = "Use: /ras - CÓDIGO - link da corrida\nEx.: /ras - BSP4K2X9 - https://...";

const textOf = (m: Incoming) => (m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? "").trim();

// O WhatsApp pode identificar a conversa por um id interno (@lid); o número vem nos campos "alternativos".
const senderPhones = (m: Incoming) =>
  [m.key?.remoteJid, m.key?.remoteJidAlt, m.key?.senderPn, m.senderPn]
    .filter((j): j is string => !!j && /@s\.whatsapp\.net$/.test(j))
    .map((j) => j.split("@")[0].split(":")[0]);

// "/ras - BSP4K2X9 - https://..." (aceita também sem os traços ou com #).
export function parseRas(text: string) {
  const m = text.match(/^\/ras\b[\s\-–—:]*#?([A-Za-z0-9]+)[\s\-–—]+(\S+)\s*$/i);
  return m ? { code: m[1].toUpperCase(), link: m[2] } : null;
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
    await sendText(member, reply);
  }
}

async function runCommand(text: string, member: string, who?: string) {
  if (!/^\/ras\b/i.test(text)) return `Comando não reconhecido.\n${USAGE}`;
  const cmd = parseRas(text);
  if (!cmd) return `Não entendi o comando.\n${USAGE}`;

  const order = await findOrderByCode(cmd.code);
  if (!order) return `❌ Pedido #${cmd.code} não encontrado. Confira o código.`;
  if (order.fulfillment === "pickup") return `❌ O pedido #${order.code} é *retirada no local*: não tem corrida para acompanhar.`;
  if (order.status === "aguardando_pagamento") return `❌ O pedido #${order.code} ainda não foi pago.`;
  if (order.status === "cancelado" || order.status === "entregue")
    return `❌ O pedido #${order.code} está como "${STATUS_LABEL[order.status]}" e não pode sair para entrega.`;
  if (order.status === "saiu_para_entrega" && order.trackingUrl === cmd.link)
    return `O pedido #${order.code} já estava como saiu para entrega com esse link. Nada mudou.`;

  let updated;
  try {
    updated = await adminUpdateOrder(order.id, { status: "saiu_para_entrega", trackingUrl: cmd.link }, { notify: false });
  } catch (e) {
    if (e instanceof OrderError) return `❌ ${e.message}`;
    throw e;
  }
  const sent = await notifyShipped(updated).catch((e) => {
    console.error(`[whatsapp] falha ao avisar o cliente do pedido ${order.code}`, e);
    return false;
  });
  await notifyTeam(`🛵 Pedido #${order.code} saiu para entrega${who ? ` (por ${who})` : ""}.`, (p) => samePhone(p, member)).catch((e) =>
    console.error("[whatsapp] falha ao avisar a equipe", e),
  );
  return [
    `✅ Pedido #${order.code} marcado como *saiu para entrega*.`,
    sent ? "Cliente avisado no WhatsApp com o link." : "⚠️ Não consegui avisar o cliente pelo WhatsApp: envie o link pelo painel.",
  ].join("\n");
}
