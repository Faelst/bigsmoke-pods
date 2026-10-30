import QRCode from "qrcode";
import { getOrder, refreshPixPayment } from "@/lib/orders";

export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const found = await getOrder((await ctx.params).id);
  if (!found) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  const order = await refreshPixPayment(found);

  const pixQr =
    order.payment.method === "pix" && order.status === "aguardando_pagamento"
      ? await QRCode.toDataURL(order.payment.pixCode, { margin: 1, width: 320 })
      : null;
  return Response.json({ order, pixQr });
}
