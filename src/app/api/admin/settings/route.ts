import { withAdmin } from "@/lib/admin-auth";
import { parseHours } from "@/lib/hours";
import { getStoreSettings, saveStoreSettings, setClosedNow } from "@/lib/settings";
import { parseSocial } from "@/lib/site";

export const GET = withAdmin(async () => Response.json({ settings: await getStoreSettings() }));

export const PUT = withAdmin(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const hours = parseHours(body.hours);
  const social = parseSocial(body.social);
  const errors = { ...hours.errors, ...social.errors };
  if (Object.keys(errors).length) return Response.json({ errors }, { status: 400 });
  return Response.json({ settings: await saveStoreSettings({ hours: hours.data, social: social.data }) });
});

// { closed: true } fecha agora até a próxima abertura; { closed: false } reabre.
export const PATCH = withAdmin(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  if (typeof body.closed !== "boolean") return Response.json({ error: "Requisição inválida" }, { status: 400 });
  return Response.json({ settings: await setClosedNow(body.closed) });
});
