import { withAdmin } from "@/lib/admin-auth";
import { adminListCoupons, CouponError, createCoupon, parseCoupon } from "@/lib/coupons";

export const GET = withAdmin(async () => Response.json({ coupons: await adminListCoupons() }));

export const POST = withAdmin(async (req: Request) => {
  try {
    const coupon = await createCoupon(parseCoupon(await req.json().catch(() => null)));
    return Response.json({ coupon }, { status: 201 });
  } catch (e) {
    if (e instanceof CouponError) return Response.json({ error: e.message, errors: e.errors }, { status: e.status });
    throw e;
  }
});
