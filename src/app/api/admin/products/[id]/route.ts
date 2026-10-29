import { withAdmin } from "@/lib/admin-auth";
import { deleteProduct, parseProduct, ProductError, updateProduct } from "@/lib/catalog";

type Ctx = RouteContext<"/api/admin/products/[id]">;

const handle = async (fn: () => Promise<Response>) => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ProductError) return Response.json({ errors: e.errors }, { status: e.status });
    throw e;
  }
};

export const PATCH = withAdmin((req: Request, ctx: Ctx) =>
  handle(async () => {
    const input = parseProduct(await req.json().catch(() => null), true);
    return Response.json({ product: await updateProduct((await ctx.params).id, input) });
  }),
);

export const DELETE = withAdmin((_req: Request, ctx: Ctx) =>
  handle(async () => {
    await deleteProduct((await ctx.params).id);
    return Response.json({ ok: true });
  }),
);
