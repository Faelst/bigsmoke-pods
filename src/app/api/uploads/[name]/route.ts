import path from "path";
import { readUpload } from "@/lib/uploads";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

// Serve as imagens enviadas pelo admin.
export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[name]">) {
  const { name } = await ctx.params;
  if (!/^[a-f0-9-]+\.(jpe?g|png|webp)$/.test(name)) return new Response("Not found", { status: 404 });
  const file = await readUpload(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": TYPES[path.extname(name)], "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
