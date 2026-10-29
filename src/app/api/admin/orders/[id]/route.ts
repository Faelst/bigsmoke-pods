import { withAdmin } from "@/lib/admin-auth";
import { adminGetOrder, adminUpdateOrder, OrderError } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

type Ctx = RouteContext<"/api/admin/orders/[id]">;

export const GET = withAdmin(async (_req: Request, ctx: Ctx) => {
  const order = await adminGetOrder((await ctx.params).id);
  if (!order) return Response.json({ error: "Pedido não encontrado" }, { status: 404 });
  return Response.json({ order });
});

export const PATCH = withAdmin(async (req: Request, ctx: Ctx) => {
  const { status, trackingUrl } = (await req.json().catch(() => ({}))) as { status?: OrderStatus; trackingUrl?: unknown };
  try {
    return Response.json({ order: await adminUpdateOrder((await ctx.params).id, { status, trackingUrl }) });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
});
