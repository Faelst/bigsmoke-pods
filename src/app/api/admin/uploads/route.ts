import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { withAdmin } from "@/lib/admin-auth";
import { DATA_DIR } from "@/lib/db";

const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const MAX = 4 * 1024 * 1024;

export const POST = withAdmin(async (req: Request) => {
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Envie um arquivo" }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return Response.json({ error: "Use JPG, PNG ou WEBP" }, { status: 415 });
  if (file.size > MAX) return Response.json({ error: "Imagem maior que 4 MB" }, { status: 413 });

  const name = `${randomUUID()}${ext}`;
  const dir = path.join(DATA_DIR, "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/api/uploads/${name}` }, { status: 201 });
});
