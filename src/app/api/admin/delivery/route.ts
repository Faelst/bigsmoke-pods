import { withAdmin } from "@/lib/admin-auth";
import { getDeliverySettings, saveDeliverySettings } from "@/lib/delivery";
import { parseAddress, parsePricing } from "@/lib/delivery-pricing";

export const GET = withAdmin(async () => Response.json({ delivery: await getDeliverySettings() }));

export const PUT = withAdmin(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const address = parseAddress(body.store);
  const pricing = parsePricing(body.pricing);
  const lat = Number(body.store?.lat);
  const lng = Number(body.store?.lng);
  const errors: Record<string, string> = { ...address.errors, ...pricing.errors };
  if (!body.store?.lat || !(Math.abs(lat) <= 90) || !body.store?.lng || !(Math.abs(lng) <= 180))
    errors.location = "Localize a loja no mapa antes de salvar";
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 400 });
  return Response.json({ delivery: await saveDeliverySettings({ ...address.data, lat, lng }, pricing.data) });
});
