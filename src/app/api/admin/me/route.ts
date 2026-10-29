import { getCurrentAdmin } from "@/lib/admin-auth";

export async function GET() {
  return Response.json({ admin: await getCurrentAdmin() });
}
