import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronLeft, Droplets, Wind } from "lucide-react";
import { getActiveProduct, listActiveProducts } from "@/lib/catalog";
import { brl } from "@/lib/format";
import { AddToCart } from "./AddToCart";

export async function generateMetadata({ params }: PageProps<"/produto/[slug]">): Promise<Metadata> {
  await connection();
  const product = await getActiveProduct((await params).slug);
  return { title: product?.name, description: product?.description };
}

export default function ProductPage({ params }: PageProps<"/produto/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 aspect-square max-w-md animate-pulse rounded-[2rem] bg-surface" />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: { params: PageProps<"/produto/[slug]">["params"] }) {
  await connection();
  const product = await getActiveProduct((await params).slug);
  if (!product) notFound();
  const related = (await listActiveProducts()).filter((p) => p.slug !== product.slug).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft className="size-4" /> Voltar
      </Link>
      <div className="mt-4 grid gap-6 md:grid-cols-2 md:gap-10">
        <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-white">
          <div className="absolute inset-x-10 bottom-0 h-1/3 rounded-full bg-brand/30 blur-3xl" />
          <Image src={product.image} alt={product.name} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-contain p-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-leaf">{product.brand}</span>
          <h1 className="mt-1 font-display text-3xl leading-tight md:text-4xl">{product.name}</h1>
          <p className="mt-3 font-display text-3xl text-brand">{brl(product.price)}</p>
          <p className="mt-1 text-sm text-muted">ou 3x de {brl(product.price / 3)} sem juros</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="card flex items-center gap-3 p-4">
              <Wind className="size-6 text-brand" />
              <div><p className="text-xs text-muted">Puffs</p><p className="font-semibold">{product.puffs}</p></div>
            </div>
            <div className="card flex items-center gap-3 p-4">
              <Droplets className="size-6 text-leaf" />
              <div><p className="text-xs text-muted">Capacidade</p><p className="font-semibold">{product.capacity}</p></div>
            </div>
          </div>
          <p className="mt-5 text-white/80">{product.description}</p>
          <AddToCart product={product} />
        </div>
      </div>

      <h2 className="mt-14 font-display text-xl">Você também pode curtir</h2>
      <div className="no-scrollbar -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {related.map((p) => (
          <Link key={p.slug} href={`/produto/${p.slug}`} className="card w-40 shrink-0 snap-start overflow-hidden transition hover:border-brand/50 sm:w-52">
            <div className="relative aspect-square bg-white">
              <Image src={p.image} alt={p.name} fill sizes="208px" className="object-contain p-3" />
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
              <p className="font-display text-brand">{brl(p.price)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
