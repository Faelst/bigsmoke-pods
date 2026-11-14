import { getCurrentCustomer } from "@/lib/auth";
import { cancelMine, mySubscription, subscribe, SubscriptionError } from "@/lib/subscriptions";

const fail = (e: unknown) => {
  if (e instanceof SubscriptionError) return Response.json({ error: e.message }, { status: e.status });
  throw e;
};

// Plano e, para quem está logado, a assinatura e o que ainda há para usar no mês.
export async function GET() {
  const customer = await getCurrentCustomer();
  return Response.json(await mySubscription(customer?.id ?? null));
}

export async function POST(req: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return Response.json({ error: "Faça login para assinar" }, { status: 401 });
  // SITE_URL (opcional) fixa o domínio público. O Mercado Pago exige um endereço público no "voltar"
  // (recusa localhost), mesmo sem redirecionar ninguém neste fluxo: em desenvolvimento vai o site dele.
  const url = new URL(req.url);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  const backUrl = `${process.env.SITE_URL?.trim().replace(/\/+$/, "") || (local ? "https://www.mercadopago.com.br" : url.origin)}/assinatura`;
  try {
    return Response.json({ subscription: await subscribe(customer, await req.json().catch(() => ({})), backUrl) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE() {
  const customer = await getCurrentCustomer();
  if (!customer) return Response.json({ error: "Faça login para continuar" }, { status: 401 });
  try {
    return Response.json({ subscription: await cancelMine(customer.id) });
  } catch (e) {
    return fail(e);
  }
}
