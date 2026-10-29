import { withAdmin } from "@/lib/admin-auth";
import { adminListOrders } from "@/lib/orders";

export const GET = withAdmin(async () => Response.json({ orders: await adminListOrders() }));
