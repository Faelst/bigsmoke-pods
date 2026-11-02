import { withAdmin } from "@/lib/admin-auth";
import { CouponError, deleteCoupon, parseCoupon, updateCoupon } from "@/lib/coupons";

type Ctx = RouteContext<"/api/admin/coupons/[id]">;

const handle = async (fn: () => Promise<Response>) => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof CouponError) return Response.json({ error: e.message, errors: e.errors }, { status: e.status });
    throw e;
  }
};

export const PATCH = withAdmin((req: Request, ctx: Ctx) =>
  handle(async () => {
    const input = parseCoupon(await req.json().catch(() => null), true);
    return Response.json({ coupon: await updateCoupon((await ctx.params).id, input) });
  }),
);

export const DELETE = withAdmin((_req: Request, ctx: Ctx) =>
  handle(async () => {
    await deleteCoupon((await ctx.params).id);
    return Response.json({ ok: true });
  }),
);
