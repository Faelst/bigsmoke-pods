import { lookupCep } from "@/lib/geo";

export async function GET(_req: Request, ctx: RouteContext<"/api/cep/[cep]">) {
  const cep = (await ctx.params).cep.replace(/\D/g, "");
  if (cep.length !== 8) return Response.json({ error: "CEP inválido" }, { status: 400 });
  const address = await lookupCep(cep);
  if (!address) return Response.json({ error: "CEP não encontrado" }, { status: 404 });
  return Response.json({ address });
}
