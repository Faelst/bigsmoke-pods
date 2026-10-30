import { withAdmin } from "@/lib/admin-auth";
import { parsePaymentFees } from "@/lib/payment-fees";
import { getPaymentFees, savePaymentFees } from "@/lib/settings";

export const GET = withAdmin(async () => Response.json({ fees: await getPaymentFees() }));

export const PUT = withAdmin(async (req: Request) => {
  const fees = parsePaymentFees(await req.json().catch(() => ({})));
  if (!fees.ok) return Response.json({ errors: fees.errors }, { status: 400 });
  return Response.json({ fees: await savePaymentFees(fees.data) });
});
