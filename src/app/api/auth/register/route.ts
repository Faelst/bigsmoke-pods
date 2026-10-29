import { AuthError, register } from "@/lib/auth";
import { parseRegister } from "@/lib/validation";

export async function POST(req: Request) {
  const { data, errors, ok } = parseRegister(await req.json().catch(() => null));
  if (!ok) return Response.json({ errors }, { status: 422 });
  try {
    return Response.json({ customer: await register(data) }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ errors: e.errors }, { status: 409 });
    throw e;
  }
}
