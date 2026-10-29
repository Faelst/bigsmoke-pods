import { withAdmin } from "@/lib/admin-auth";
import { parseAddress } from "@/lib/delivery-pricing";
import { geocode, GeoError } from "@/lib/geo";

export const POST = withAdmin(async (req: Request) => {
  const address = parseAddress((await req.json().catch(() => ({}))).address);
  if (!address.ok) return Response.json({ errors: address.errors }, { status: 400 });
  try {
    return Response.json({ point: await geocode(address.data) });
  } catch (e) {
    if (e instanceof GeoError) return Response.json({ error: e.message }, { status: 422 });
    throw e;
  }
});
