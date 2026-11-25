import type { SubscriberBenefit, SubscriptionPlan } from "./types";

// Conta dos benefícios do assinante, igual no checkout e no servidor (lib/orders.ts).

// Até o admin ligar e ajustar em Assinaturas.
export const DEFAULT_PLAN: SubscriptionPlan = { enabled: false, price: 129.9, podLimit: 140, secondPodPercent: 15, minMonths: 3 };

const round2 = (n: number) => Math.round(n * 100) / 100;

// Pod do mês: a unidade mais cara do carrinho sai de graça (até podLimit).
// 2º pod: a próxima unidade mais cara leva o desconto. O resto paga o preço cheio.
export function applySubscription(benefit: SubscriberBenefit | null | undefined, items: { price: number; qty: number }[]) {
  const none = { freePod: 0, secondPod: 0, discount: 0 };
  if (!benefit || (!benefit.freePod && !benefit.secondPod)) return none;
  const units = items.flatMap((i) => Array<number>(Math.max(0, Math.floor(i.qty))).fill(i.price)).sort((a, b) => b - a);
  if (units.length === 0) return none;
  const freePod = benefit.freePod ? round2(Math.min(units[0], benefit.podLimit)) : 0;
  const second = benefit.freePod ? units[1] : units[0];
  const secondPod = benefit.secondPod && second !== undefined ? round2((second * benefit.percent) / 100) : 0;
  return { freePod, secondPod, discount: round2(freePod + secondPod) };
}

export const percentLabel = (n: number) => `${n.toLocaleString("pt-BR")}%`;
