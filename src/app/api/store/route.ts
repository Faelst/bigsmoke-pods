import { connection } from "next/server";
import { storeStatus } from "@/lib/hours";
import { getPaymentFees, getStoreSettings } from "@/lib/settings";

// Situação da loja (aberta/fechada), redes sociais e taxas de pagamento para o site.
export async function GET() {
  await connection(); // sempre na hora do pedido: depende do relógio e do admin
  const [{ hours, social, closedUntil }, paymentFees] = await Promise.all([getStoreSettings(), getPaymentFees()]);
  return Response.json({ status: storeStatus(hours, new Date(), closedUntil), hours, social, paymentFees });
}
