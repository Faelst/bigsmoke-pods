import { withAdmin } from "@/lib/admin-auth";
import { createProduct, listAllProducts, parseProduct, ProductError } from "@/lib/catalog";

export const GET = withAdmin(async () => Response.json({ products: await listAllProducts() }));

export const POST = withAdmin(async (req: Request) => {
  try {
    const product = await createProduct(parseProduct(await req.json().catch(() => null)));
    return Response.json({ product }, { status: 201 });
  } catch (e) {
    if (e instanceof ProductError) return Response.json({ errors: e.errors }, { status: e.status });
    throw e;
  }
});
