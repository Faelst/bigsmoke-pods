import { withAdmin } from "@/lib/admin-auth";
import { parseAddress } from "@/lib/delivery-pricing";
import { geocode, GeoError, route } from "@/lib/geo";

// Distância/tempo da loja (ainda não salva) até um endereço; a taxa é
// calculada no navegador com a tabela que está sendo editada.
export const POST = withAdmin(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const from = { lat: Number(body.from?.lat), lng: Number(body.from?.lng) };
  const address = parseAddress(body.address);
  if (!address.ok) return Response.json({ errors: address.errors }, { status: 400 });
  if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng) || !body.from)
    return Response.json({ error: "Localize a loja primeiro" }, { status: 400 });
  try {
    const point = await geocode(address.data);
    return Response.json({ point, ...(await route(from, point)) });
  } catch (e) {
    if (e instanceof GeoError) return Response.json({ error: e.message }, { status: 422 });
    throw e;
  }
});
