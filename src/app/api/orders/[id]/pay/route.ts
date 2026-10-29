import { getCurrentCustomer } from "@/lib/auth";
import { confirmPix, OrderError } from "@/lib/orders";

export async function POST(_req: Request, ctx: RouteContext<"/api/orders/[id]/pay">) {
  const customer = await getCurrentCustomer();
  if (!customer) return Response.json({ error: "Faça login para continuar" }, { status: 401 });
  try {
    return Response.json({ order: await confirmPix(customer.id, (await ctx.params).id) });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
