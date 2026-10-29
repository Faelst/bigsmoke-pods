import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/db";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

// Serve as imagens enviadas pelo admin (gravadas em data/uploads).
export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[name]">) {
  const { name } = await ctx.params;
  if (!/^[a-f0-9-]+\.(jpe?g|png|webp)$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const file = await fs.readFile(path.join(DATA_DIR, "uploads", name));
    return new Response(file, {
      headers: { "Content-Type": TYPES[path.extname(name)], "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
