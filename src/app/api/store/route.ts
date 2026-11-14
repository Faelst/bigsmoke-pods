import { connection } from "next/server";
import { storeStatus } from "@/lib/hours";
import { getPaymentFees, getStoreSettings } from "@/lib/settings";
import { getPlan } from "@/lib/subscriptions";

// Situação da loja (aberta/fechada), redes sociais, taxas de pagamento e plano de assinatura para o site.
export async function GET() {
  await connection(); // sempre na hora do pedido: depende do relógio e do admin
  const [{ hours, social, closedUntil }, paymentFees, plan] = await Promise.all([getStoreSettings(), getPaymentFees(), getPlan()]);
  return Response.json({ status: storeStatus(hours, new Date(), closedUntil), hours, social, paymentFees, plan });
}
