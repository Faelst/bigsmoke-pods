import { Suspense } from "react";
import { OrdersAdmin } from "./OrdersAdmin";

export const metadata = { title: "Pedidos" };

export default function Page() {
  return (
    <Suspense>
      <OrdersAdmin />
    </Suspense>
  );
}
