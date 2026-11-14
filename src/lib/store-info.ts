"use client";

import { useEffect } from "react";
import { DEFAULT_SOCIAL } from "./site";
import { createStore, useStore } from "./store";
import type { DayHours, PaymentFees, SocialLinks, StoreStatus, SubscriptionPlan } from "./types";

type State = { status: StoreStatus | null; hours: DayHours[] | null; social: SocialLinks; paymentFees: PaymentFees | null; plan: SubscriptionPlan | null };
const infoStore = createStore<State>({ status: null, hours: null, social: DEFAULT_SOCIAL, paymentFees: null, plan: null });
let fetchedAt = 0;

export function refreshStoreInfo() {
  fetchedAt = Date.now();
  return fetch("/api/store")
    .then((r) => r.json())
    .then((data: State) => infoStore.set(data))
    .catch(() => (fetchedAt = 0));
}

// Situação da loja, redes sociais e taxas de pagamento; atualiza no máximo a cada minuto.
export function useStoreInfo() {
  const state = useStore(infoStore);
  useEffect(() => {
    if (Date.now() - fetchedAt > 60_000) refreshStoreInfo();
  }, []);
  return state;
}
