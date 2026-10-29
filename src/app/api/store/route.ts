import { connection } from "next/server";
import { storeStatus } from "@/lib/hours";
import { getStoreSettings } from "@/lib/settings";

// Situação da loja (aberta/fechada) e redes sociais para o site.
export async function GET() {
  await connection(); // sempre na hora do pedido: depende do relógio e do admin
  const { hours, social, closedUntil } = await getStoreSettings();
  return Response.json({ status: storeStatus(hours, new Date(), closedUntil), hours, social });
}
