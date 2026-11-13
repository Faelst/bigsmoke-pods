import { withAdmin } from "@/lib/admin-auth";
import { adminCreateManualOrder, adminListOrders, OrderError } from "@/lib/orders";

export const GET = withAdmin(async () => Response.json({ orders: await adminListOrders() }));

// Lança uma venda feita por fora da loja.
export const POST = withAdmin(async (req: Request) => {
  try {
    const order = await adminCreateManualOrder(await req.json().catch(() => ({})));
    return Response.json({ order }, { status: 201 });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
});
