import { getCurrentCustomer } from "@/lib/auth";

export async function GET() {
  return Response.json({ customer: await getCurrentCustomer() });
}
