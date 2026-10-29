"use client";

import { useEffect } from "react";
import { createStore, useStore } from "./store";
import type { Customer } from "./types";

type State = { customer: Customer | null; loaded: boolean };
const sessionStore = createStore<State>({ customer: null, loaded: false });
let inflight: Promise<void> | null = null;

export function refreshSession() {
  inflight ??= fetch("/api/me")
    .then((r) => r.json())
    .then(({ customer }) => sessionStore.set({ customer, loaded: true }))
    .catch(() => sessionStore.set({ customer: null, loaded: true }))
    .finally(() => (inflight = null));
  return inflight;
}

export function useSession() {
  const state = useStore(sessionStore);
  useEffect(() => {
    if (!state.loaded) refreshSession();
  }, [state.loaded]);
  return state;
}

async function authRequest(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) return { errors: (json.errors ?? { form: json.error ?? "Erro inesperado" }) as Record<string, string> };
  sessionStore.set({ customer: json.customer, loaded: true });
  return { customer: json.customer as Customer };
}

export const login = (data: { email: string; password: string }) => authRequest("/api/auth/login", data);

export const register = (data: { name: string; email: string; phone: string; instagram: string; password: string }) =>
  authRequest("/api/auth/register", data);

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  sessionStore.set({ customer: null, loaded: true });
}
