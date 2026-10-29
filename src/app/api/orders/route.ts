import { getCurrentCustomer } from "@/lib/auth";
import { createOrder, listOrders, OrderError } from "@/lib/orders";

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return Response.json({ error: "Faça login para continuar" }, { status: 401 });
  return Response.json({ orders: await listOrders(customer.id) });
}

// Conta é opcional: logado, o pedido também fica ligado à conta.
export async function POST(req: Request) {
  const customer = await getCurrentCustomer();
  try {
    const order = await createOrder(customer?.id ?? null, await req.json());
    return Response.json({ order }, { status: 201 });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
