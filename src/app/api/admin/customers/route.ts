import { withAdmin } from "@/lib/admin-auth";
import { adminListCustomers } from "@/lib/orders";

export const GET = withAdmin(async () => Response.json({ customers: await adminListCustomers() }));
