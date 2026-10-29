import QRCode from "qrcode";
import { getCurrentCustomer } from "@/lib/auth";
import { getOrder } from "@/lib/orders";

export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const customer = await getCurrentCustomer();
  if (!customer) return Response.json({ error: "Faça login para continuar" }, { status: 401 });
  const order = await getOrder(customer.id, (await ctx.params).id);
  if (!order) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });

  const pixQr =
    order.payment.method === "pix" && order.status === "aguardando_pagamento"
      ? await QRCode.toDataURL(order.payment.pixCode, { margin: 1, width: 320 })
      : null;
  return Response.json({ order, pixQr });
}
