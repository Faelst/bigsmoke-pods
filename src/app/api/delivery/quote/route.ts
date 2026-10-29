import { DeliveryError, quoteDelivery } from "@/lib/delivery";
import { parseAddress } from "@/lib/delivery-pricing";

// Estimativa exibida no checkout; o valor final é recalculado ao criar o pedido.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = parseAddress(body.address);
  if (!address.ok) return Response.json({ errors: address.errors }, { status: 400 });
  try {
    const { quote, preorder } = await quoteDelivery(address.data, Math.max(0, Number(body.subtotal) || 0));
    return Response.json({ quote, preorder });
  } catch (e) {
    if (e instanceof DeliveryError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
