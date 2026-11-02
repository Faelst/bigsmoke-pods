import { timingSafeEqual } from "crypto";
import { handleIncoming } from "@/lib/whatsapp-commands";
import { WEBHOOK_SECRET } from "@/lib/whatsapp";

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Mensagens recebidas pela instância da loja na Evolution API (configurado em Loja → WhatsApp).
// O endereço leva ?token=WHATSAPP_WEBHOOK_SECRET; sem ele, nada é processado.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!WEBHOOK_SECRET) return Response.json({ error: "WHATSAPP_WEBHOOK_SECRET não configurado" }, { status: 503 });
  if (!sameSecret(token, WEBHOOK_SECRET)) return Response.json({ error: "Token inválido" }, { status: 401 });
  try {
    await handleIncoming(await req.json().catch(() => null));
  } catch (e) {
    // Responde 200 mesmo assim: reenviar a mesma mensagem não resolveria.
    console.error("[whatsapp] erro ao processar mensagem recebida", e);
  }
  return new Response(null, { status: 200 });
}
