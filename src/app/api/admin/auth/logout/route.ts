import { adminSignOut } from "@/lib/admin-auth";

export async function POST() {
  await adminSignOut();
  return Response.json({ ok: true });
}
