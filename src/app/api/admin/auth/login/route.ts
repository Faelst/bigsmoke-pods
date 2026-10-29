import { adminSignIn } from "@/lib/admin-auth";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const admin = await adminSignIn(String(b.email ?? ""), String(b.password ?? ""));
  if (!admin) return Response.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  return Response.json({ admin });
}
