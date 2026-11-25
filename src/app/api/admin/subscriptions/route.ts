import { withAdmin } from "@/lib/admin-auth";
import { adminListSubscriptions, savePlan, SubscriptionError } from "@/lib/subscriptions";

export const GET = withAdmin(async () => Response.json(await adminListSubscriptions()));

// Salva o plano (liga/desliga, mensalidade, benefícios e fidelidade).
export const PUT = withAdmin(async (req: Request) => {
  try {
    return Response.json({ plan: await savePlan(await req.json().catch(() => ({}))) });
  } catch (e) {
    if (e instanceof SubscriptionError) return Response.json({ error: e.message, errors: e.errors }, { status: e.status });
    throw e;
  }
});
