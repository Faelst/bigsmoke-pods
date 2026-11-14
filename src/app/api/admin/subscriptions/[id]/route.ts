import { withAdmin } from "@/lib/admin-auth";
import { adminCancelSubscription, adminSyncSubscription, SubscriptionError } from "@/lib/subscriptions";

type Ctx = RouteContext<"/api/admin/subscriptions/[id]">;

const run = (action: (id: string) => Promise<unknown>) =>
  withAdmin(async (_req: Request, ctx: Ctx) => {
    try {
      return Response.json({ subscription: await action((await ctx.params).id) });
    } catch (e) {
      if (e instanceof SubscriptionError) return Response.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });

// POST: confere a assinatura no Mercado Pago agora. DELETE: cancela (sem olhar a fidelidade).
export const POST = run(adminSyncSubscription);
export const DELETE = run(adminCancelSubscription);
