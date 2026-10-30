import { InvalidWebhookSignatureError, MPBadRequestError, MPNotFoundError, WebhookSignatureValidator } from "mercadopago";
import { getMpOrder, mpConfigured } from "@/lib/mercadopago";
import { applyMpOrder } from "@/lib/orders";

const PENDING = ["created", "processing", "action_required"];

// Notificações do Mercado Pago (Suas integrações → Webhooks → evento "Order (Mercado Pago)").
// Com MP_WEBHOOK_SECRET, só aceita chamadas assinadas pelo Mercado Pago.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const type = url.searchParams.get("type") ?? body?.type;
  const dataId = url.searchParams.get("data.id") ?? body?.data?.id;

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: req.headers.get("x-signature"),
        xRequestId: req.headers.get("x-request-id"),
        // A assinatura usa o id em minúsculas (os ids de order são alfanuméricos).
        dataId: url.searchParams.get("data.id")?.toLowerCase(),
        secret,
      });
    } catch (e) {
      if (!(e instanceof InvalidWebhookSignatureError)) throw e;
      console.warn(`[mercadopago] webhook recusado: ${e.reason} (request ${e.requestId ?? "?"})`);
      return Response.json({ error: "Assinatura inválida" }, { status: 401 });
    }
  }

  // Outros eventos (e orders que não são da loja) só são confirmados.
  if (type !== "order" || !dataId) return new Response(null, { status: 200 });
  if (!mpConfigured) return Response.json({ error: "MP_ACCESS_TOKEN não configurado" }, { status: 503 });
  // O status da notificação só indica o que esperar: logo após um aviso de order finalizada
  // (paga, cancelada…) a consulta às vezes ainda devolve a versão pendente, então consulta de novo.
  const notified = typeof body?.data?.status === "string" ? body.data.status : undefined;
  try {
    for (let attempt = 0; ; attempt++) {
      const mp = await getMpOrder(String(dataId).toUpperCase());
      await applyMpOrder(mp);
      if (!notified || PENDING.includes(notified) || !PENDING.includes(mp.status ?? "")) break;
      if (attempt === 2) {
        console.warn(`[mercadopago] order ${dataId} ainda em ${mp.status} (aviso: ${notified}); aguardando reenvio`);
        return Response.json({ error: "Order ainda não atualizada" }, { status: 503 });
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }
  } catch (e) {
    // Order que não existe (ex.: "Simular notificação" do painel): confirma para não haver reenvio.
    // Outros erros respondem 500 e o Mercado Pago tenta de novo.
    if (!(e instanceof MPBadRequestError || e instanceof MPNotFoundError)) throw e;
    console.warn(`[mercadopago] webhook para order inexistente: ${dataId}`);
  }
  return new Response(null, { status: 200 });
}
