import { withAdmin } from "@/lib/admin-auth";
import { adminStats } from "@/lib/orders";

export const GET = withAdmin(async () => Response.json(await adminStats()));
