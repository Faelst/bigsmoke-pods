import { Suspense } from "react";
import { connection } from "next/server";
import { Hero } from "@/components/Hero";
import { Catalog } from "@/components/Catalog";
import { listActiveProducts } from "@/lib/catalog";

export default function Home() {
  return (
    <>
      <Hero />
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogLoader />
      </Suspense>
    </>
  );
}

async function CatalogLoader() {
  await connection(); // catálogo sempre atualizado (editado pelo admin)
  return <Catalog products={await listActiveProducts()} />;
}

function CatalogSkeleton() {
  return (
    <div className="mx-auto mt-4 grid max-w-6xl grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="card aspect-[3/4] animate-pulse" />)}
    </div>
  );
}
