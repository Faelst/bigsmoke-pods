import { checkCoupon, CouponError } from "@/lib/coupons";

// Checkout: confere o código digitado (o pedido confere de novo ao ser criado).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: unknown; phone?: unknown };
  try {
    return Response.json({ coupon: await checkCoupon(body.code, body.phone) });
  } catch (e) {
    if (e instanceof CouponError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
