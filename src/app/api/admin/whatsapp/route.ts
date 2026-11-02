import { withAdmin } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { findWebhook, INSTANCE, sendText, setWebhook, WEBHOOK_SECRET, whatsappConfigured } from "@/lib/whatsapp";

const webhookPath = "/api/webhooks/whatsapp";

// Situação da integração: variáveis configuradas e para onde o webhook da instância aponta.
export const GET = withAdmin(async () => {
  if (!whatsappConfigured) return Response.json({ configured: false, instance: INSTANCE, secret: !!WEBHOOK_SECRET });
  try {
    const hook = await findWebhook();
    const url = hook?.url ?? null;
    return Response.json({
      configured: true,
      instance: INSTANCE,
      secret: !!WEBHOOK_SECRET,
      webhook: { enabled: !!hook?.enabled, url: url?.replace(/token=[^&]+/, "token=•••"), ours: !!url?.includes(webhookPath) },
    });
  } catch (e) {
    return Response.json({ configured: true, instance: INSTANCE, secret: !!WEBHOOK_SECRET, error: (e as Error).message });
  }
});

// { action: "webhook" } aponta a instância para esta loja; { action: "test" } manda uma mensagem para a equipe.
export const POST = withAdmin(async (req: Request) => {
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (!whatsappConfigured) return Response.json({ error: "Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor" }, { status: 503 });
  try {
    if (action === "webhook") {
      if (!WEBHOOK_SECRET) return Response.json({ error: "Configure WHATSAPP_WEBHOOK_SECRET no servidor" }, { status: 503 });
      // SITE_URL (opcional) fixa o domínio público, ex.: o domínio próprio em vez do *.vercel.app.
      const origin = process.env.SITE_URL?.trim().replace(/\/+$/, "") || new URL(req.url).origin;
      if (/\/\/(localhost|127\.|192\.168\.)/.test(origin))
        return Response.json({ error: `O webhook precisa de um endereço público (${origin} só existe no seu computador). Conecte pelo site publicado.` }, { status: 400 });
      await setWebhook(`${origin}${webhookPath}?token=${encodeURIComponent(WEBHOOK_SECRET)}`);
      return Response.json({ ok: true });
    }
    if (action === "test") {
      const team = await query((db) => db.settings.teamPhones ?? []);
      if (!team.length) return Response.json({ error: "Cadastre e salve pelo menos um número da equipe" }, { status: 400 });
      const results = await Promise.allSettled(team.map((p) => sendText(p, "✅ Teste da Big Smoke Pods: os avisos de pedido vão chegar neste WhatsApp.")));
      const failed = team.filter((_, i) => results[i].status === "rejected");
      if (failed.length) return Response.json({ error: `Não foi possível enviar para: ${failed.join(", ")}` }, { status: 502 });
      return Response.json({ ok: true, sent: team.length });
    }
    return Response.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    console.error("[whatsapp] erro na configuração", e);
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
});
