"use client";

import { useCallback, useEffect, useState } from "react";

// fetch do painel: em 401 volta para o login do admin.
export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (res.status === 401) {
    window.location.replace(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("unauthorized");
  }
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Erro"), { errors: json.errors });
  return json;
}

// Carrega um recurso do admin e expõe reload.
export function useAdminData<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const reload = useCallback(() => adminFetch<T>(url).then(setData).catch(() => {}), [url]);
  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);
  return { data, setData, reload };
}
