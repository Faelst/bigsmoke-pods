import { AuthError, signIn } from "@/lib/auth";
import { parseLogin } from "@/lib/validation";

export async function POST(req: Request) {
  const { data, errors, ok } = parseLogin(await req.json().catch(() => null));
  if (!ok) return Response.json({ errors }, { status: 422 });
  try {
    return Response.json({ customer: await signIn(data.email, data.password) });
  } catch (e) {
    if (e instanceof AuthError) return Response.json({ errors: e.errors }, { status: 401 });
    throw e;
  }
}
