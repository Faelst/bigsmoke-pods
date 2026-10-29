import type { NextRequest } from "next/server";
import { listActiveProducts } from "@/lib/catalog";
import { filterProducts } from "@/lib/products";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const brand = req.nextUrl.searchParams.get("brand") ?? undefined;
  return Response.json({ products: filterProducts(await listActiveProducts(), q, brand) });
}
