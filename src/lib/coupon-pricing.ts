import { brl } from "./format";
import type { CouponOffer, DeliveryQuote } from "./types";

// Conta do cupom, igual no checkout e no servidor (lib/orders.ts) para o total bater nos dois lados.

const round2 = (n: number) => Math.round(n * 100) / 100;

// Frete grátis zera a entrega; o desconto em % ou em R$ vale só sobre os produtos.
// A taxa de processamento é calculada depois, sobre o valor já com desconto.
export function applyCoupon(coupon: CouponOffer | null | undefined, subtotal: number, delivery: DeliveryQuote) {
  if (coupon?.kind === "free_shipping") {
    return { discount: delivery.fee, productDiscount: 0, delivery: { ...delivery, fee: 0, free: true } };
  }
  const productDiscount =
    coupon?.kind === "percent"
      ? round2((subtotal * (coupon.percent ?? 0)) / 100)
      : coupon?.kind === "fixed"
        ? round2(Math.min(coupon.amount ?? 0, subtotal))
        : 0;
  return { discount: productDiscount, productDiscount, delivery };
}

// Valor antes da taxa de processamento.
export const couponBase = (subtotal: number, productDiscount: number, deliveryFee: number) => round2(subtotal - productDiscount + deliveryFee);

export const couponLabel = (c: CouponOffer) =>
  c.kind === "free_shipping"
    ? "Frete grátis"
    : c.kind === "fixed"
      ? `${brl(c.amount ?? 0)} de desconto`
      : `${(c.percent ?? 0).toLocaleString("pt-BR")}% de desconto`;

// Desconto nos produtos (em % ou em R$), ao contrário do frete grátis.
export const isProductDiscount = (c: Pick<CouponOffer, "kind">) => c.kind !== "free_shipping";
