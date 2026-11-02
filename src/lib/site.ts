import { onlyDigits } from "./format";
import type { SocialLinks } from "./types";

export const SITE = { name: "Big Smoke Pods" };

// Padrão até o admin editar as redes sociais no painel.
export const DEFAULT_SOCIAL: SocialLinks = { whatsapp: "5512996190474", instagram: "bigsmokepods.oficial", tiktok: "" };

export const DEFAULT_WHATSAPP_TEXT = "👋 Olá, venho do site Big Smoke Pods!\nEu quero fazer o próximo pedido:\n";

export const whatsappLink = (phone: string, text = DEFAULT_WHATSAPP_TEXT) =>
  `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}`;
export const tiktokUrl = (handle: string) => `https://www.tiktok.com/@${handle}`;

// Aceita "@perfil", "perfil" ou o link do perfil.
const handle = (v: unknown) =>
  String(v ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?].*$/, "");
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

export function parseSocial(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  let whatsapp = onlyDigits(String(b.whatsapp ?? ""));
  if (whatsapp.length === 10 || whatsapp.length === 11) whatsapp = `55${whatsapp}`;
  const data: SocialLinks = { whatsapp, instagram: handle(b.instagram), tiktok: handle(b.tiktok) };
  const errors: Record<string, string> = {};
  if (whatsapp.length < 12 || whatsapp.length > 13) errors.whatsapp = "Informe DDD + número";
  if (!HANDLE_RE.test(data.instagram)) errors.instagram = "Perfil inválido";
  if (data.tiktok && !HANDLE_RE.test(data.tiktok)) errors.tiktok = "Perfil inválido";
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

// WhatsApp da equipe (avisos de pedido e comando /ras): DDD + número, vira 55 + número.
export function parseTeamPhones(body: unknown) {
  const list = Array.isArray(body) ? body : [];
  const errors: Record<string, string> = {};
  const data: string[] = [];
  list.slice(0, 20).forEach((raw, i) => {
    let phone = onlyDigits(String(raw ?? ""));
    if (!phone) return;
    if (phone.length === 10 || phone.length === 11) phone = `55${phone}`;
    if (phone.length < 12 || phone.length > 13) errors[`team${i}`] = "Informe DDD + número";
    else if (!data.includes(phone)) data.push(phone);
  });
  return { data, errors, ok: Object.keys(errors).length === 0 };
}
