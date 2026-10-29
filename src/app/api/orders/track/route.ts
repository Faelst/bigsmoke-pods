import { onlyDigits } from "@/lib/format";
import { trackOrders } from "@/lib/orders";

// Acompanhar pelo WhatsApp: { phone, ids } → pedidos resumidos daquele número.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = onlyDigits(String(body.phone ?? ""));
  if (phone.length !== 10 && phone.length !== 11) return Response.json({ error: "Informe o WhatsApp com DDD" }, { status: 400 });
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string").slice(0, 100) : [];
  return Response.json({ orders: await trackOrders(phone, ids) });
}
