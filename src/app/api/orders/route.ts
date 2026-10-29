import { getCurrentCustomer } from "@/lib/auth";
import { createOrder, listOrders, OrderError } from "@/lib/orders";

const unauthorized = () => Response.json({ error: "Faça login para continuar" }, { status: 401 });

export async function GET() {
  const customer = await getCurrentCustomer();
  if (!customer) return unauthorized();
  return Response.json({ orders: await listOrders(customer.id) });
}

export async function POST(req: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return unauthorized();
  try {
    const order = await createOrder(customer.id, await req.json());
    return Response.json({ order }, { status: 201 });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
