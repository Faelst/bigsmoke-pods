import { MapPin, Store } from "lucide-react";
import { brl } from "@/lib/format";
import { formatAddress } from "@/lib/delivery-pricing";
import { couponLabel } from "@/lib/coupon-pricing";
import type { Order } from "@/lib/types";

export function OrderTotals({ order }: { order: Order }) {
  const pickup = order.fulfillment === "pickup";
  if (!order.delivery && !pickup) return <div className="mt-4 border-t border-line" />;
  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm text-muted">
      {order.address && (
        <p className="mb-2 flex gap-2 rounded-xl bg-surface-2 p-3 text-white">
          <MapPin className="mt-0.5 size-4 shrink-0 text-brand" /> {formatAddress(order.address)}
        </p>
      )}
      {pickup && (
        <p className="mb-2 flex gap-2 rounded-xl bg-surface-2 p-3 text-white">
          <Store className="mt-0.5 size-4 shrink-0 text-brand" /> Retirada no local, combinada pelo WhatsApp
        </p>
      )}
      <div className="flex justify-between"><span>Subtotal</span><span>{brl(order.subtotal ?? order.total)}</span></div>
      {pickup ? (
        <div className="flex justify-between"><span>Retirada</span><span className="font-semibold text-leaf">Grátis</span></div>
      ) : order.delivery && (
      <div className="flex justify-between">
        <span>Entrega ({order.delivery.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km)</span>
        <span>{order.delivery.free ? <span className="font-semibold text-leaf">Grátis</span> : brl(order.delivery.fee)}</span>
      </div>
      )}
      {order.coupon && (
        <div className="flex justify-between text-leaf">
          <span>Cupom {order.coupon.code} ({couponLabel(order.coupon).toLowerCase()})</span>
          {/* No frete grátis o valor já aparece como "Grátis" na entrega: aqui só a economia. */}
          <span>{order.coupon.kind === "percent" ? `−${brl(order.coupon.discount)}` : `economia de ${brl(order.coupon.discount)}`}</span>
        </div>
      )}
      {order.paymentFee !== undefined && (
        <div className="flex justify-between"><span>Taxa de processamento</span><span>{brl(order.paymentFee)}</span></div>
      )}
    </div>
  );
}
