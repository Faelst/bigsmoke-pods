import type { InstallmentTier, PaymentFees } from "./types";

// Cartão de crédito no Mercado Pago parcela em até 12x.
export const MAX_INSTALLMENTS = 12;

// Até o admin configurar: sem taxa e parcelamento pelo exemplo da loja.
export const DEFAULT_PAYMENT_FEES: PaymentFees = {
  pixPercent: 0,
  cardPercent: Array(MAX_INSTALLMENTS).fill(0),
  tiers: [
    { minTotal: 200, maxInstallments: 2 },
    { minTotal: 300, maxInstallments: 3 },
    { minTotal: 500, maxInstallments: 5 },
  ],
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Parcelas liberadas para um total: a maior faixa alcançada (abaixo de todas, só à vista).
export function maxInstallmentsFor(fees: PaymentFees, total: number) {
  return fees.tiers.reduce((max, t) => (total >= t.minTotal ? Math.max(max, t.maxInstallments) : max), 1);
}

// Taxa de processamento (porcentagem sobre o total do pedido) e o valor final cobrado.
export function paymentFee(fees: PaymentFees, total: number, method: "pix" | "card", installments = 1) {
  const percent = method === "pix" ? fees.pixPercent : (fees.cardPercent[installments - 1] ?? 0);
  const fee = round2((total * percent) / 100);
  return { percent, fee, total: round2(total + fee) };
}

// Opções do seletor de parcelas, já com a taxa de cada uma.
export function installmentOptions(fees: PaymentFees, total: number) {
  return Array.from({ length: maxInstallmentsFor(fees, total) }, (_, i) => {
    const n = i + 1;
    const charge = paymentFee(fees, total, "card", n);
    return { installments: n, ...charge, each: round2(charge.total / n) };
  });
}

const num = (v: unknown) => Number(String(v ?? "").replace(",", "."));

export function parsePaymentFees(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const percent = (v: unknown, key: string) => {
    const n = num(v);
    if (!Number.isFinite(n) || n < 0 || n > 50) errors[key] = "Use uma porcentagem entre 0 e 50";
    return Number.isFinite(n) ? round2(n) : 0;
  };

  const pixPercent = percent(b.pixPercent, "pixPercent");
  const rawCard = Array.isArray(b.cardPercent) ? b.cardPercent : [];
  const cardPercent = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => percent(rawCard[i] ?? 0, `card${i}`));

  const tiers: InstallmentTier[] = (Array.isArray(b.tiers) ? b.tiers : []).map((raw, i) => {
    const t = (raw ?? {}) as Record<string, unknown>;
    const minTotal = round2(num(t.minTotal));
    const maxInstallments = Math.floor(num(t.maxInstallments));
    if (!(minTotal > 0)) errors[`tier${i}`] = "Informe o valor mínimo da compra";
    else if (!(maxInstallments >= 2 && maxInstallments <= MAX_INSTALLMENTS)) errors[`tier${i}`] = `Parcelas entre 2 e ${MAX_INSTALLMENTS}`;
    return { minTotal, maxInstallments };
  });
  tiers.sort((a, b) => a.minTotal - b.minTotal);

  return { data: { pixPercent, cardPercent, tiers } as PaymentFees, errors, ok: Object.keys(errors).length === 0 };
}
