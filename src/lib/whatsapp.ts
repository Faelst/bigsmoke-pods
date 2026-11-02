import "server-only";
import { after } from "next/server";
import { onlyDigits } from "./format";

// Evolution API (v2): envia mensagens pela instância da loja e recebe as mensagens da equipe por webhook.
// EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE ficam só no servidor.
const API_URL = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, "");
const API_KEY = process.env.EVOLUTION_API_KEY?.trim();
export const INSTANCE = process.env.EVOLUTION_INSTANCE?.trim() || "SafetySwap-bkp";
// Vai no endereço do webhook: sem ele, ninguém de fora consegue mandar comandos.
export const WEBHOOK_SECRET = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();

export const whatsappConfigured = !!(API_URL && API_KEY);

async function evolution<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!whatsappConfigured) throw new Error("Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY)");
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { apikey: API_KEY!, ...(body !== undefined && { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Evolution ${res.status} em ${path}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

const instancePath = (action: string) => `/${action}/${encodeURIComponent(INSTANCE)}`;

// number: só dígitos, com DDI (ex.: 5512999999999).
export const sendText = (number: string, text: string) => evolution("POST", instancePath("message/sendText"), { number, text });

// Só o evento de mensagens recebidas, que é o que a loja usa.
export const setWebhook = (url: string) =>
  evolution("POST", instancePath("webhook/set"), {
    webhook: { enabled: true, url, byEvents: false, base64: false, events: ["MESSAGES_UPSERT"] },
  });

export const findWebhook = () => evolution<{ enabled?: boolean; url?: string } | null>("GET", instancePath("webhook/find"));

// ---- Números ----

// Telefone do cliente (DDD + número) ou da equipe → número com 55.
export function waNumber(phone: string) {
  const d = onlyDigits(phone);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

// Celular brasileiro pode chegar com ou sem o 9 extra (o WhatsApp de números antigos usa 12 dígitos).
function variants(n: string) {
  const d = waNumber(n);
  const out = new Set([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") out.add(d.slice(0, 4) + d.slice(5));
  if (d.startsWith("55") && d.length === 12) out.add(`${d.slice(0, 4)}9${d.slice(4)}`);
  return out;
}

export const samePhone = (a: string, b: string) => [...variants(a)].some((v) => variants(b).has(v));

// Envio depois da resposta: uma falha no WhatsApp nunca trava o pedido nem o pagamento.
export function later(task: () => Promise<unknown>) {
  const run = () => task().catch((e) => console.error("[whatsapp] falha ao enviar", e));
  try {
    after(run);
  } catch {
    // Fora de uma requisição (ex.: script): envia agora mesmo.
    void run();
  }
}
