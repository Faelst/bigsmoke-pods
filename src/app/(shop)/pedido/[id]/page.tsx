import { Suspense } from "react";
import { OrderView } from "./OrderView";

export const metadata = { title: "Pedido" };

export default function OrderPage({ params }: PageProps<"/pedido/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-6 h-64 max-w-3xl animate-pulse rounded-3xl bg-surface px-4" />}>
      {params.then(({ id }) => <OrderView id={id} />)}
    </Suspense>
  );
}
