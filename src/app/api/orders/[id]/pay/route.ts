import { confirmPix, OrderError } from "@/lib/orders";

export async function POST(_req: Request, ctx: RouteContext<"/api/orders/[id]/pay">) {
  try {
    return Response.json({ order: await confirmPix((await ctx.params).id) });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
