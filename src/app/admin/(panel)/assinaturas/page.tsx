"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw, Save } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { brl, formatDate, formatPhone } from "@/lib/format";
import type { SubscriberBenefit, Subscription, SubscriptionPlan, SubscriptionStatus } from "@/lib/types";
import { Field, PageTitle, Toggle } from "@/components/admin/ui";

type Row = Subscription & { customer: { name: string; email: string; phone: string } | null; paidMonths: number; benefit: SubscriberBenefit | null };
type Data = { plan: SubscriptionPlan; subscriptions: Row[] };

const STATUS: Record<SubscriptionStatus, { label: string; className: string }> = {
  pendente: { label: "1ª cobrança pendente", className: "bg-brand/15 text-brand" },
  ativa: { label: "Ativa", className: "bg-leaf/15 text-leaf" },
  suspensa: { label: "Não paga", className: "bg-red-500/15 text-red-300" },
  cancelada: { label: "Cancelada", className: "bg-white/10 text-muted" },
};
const BY = { customer: "pelo cliente", admin: "pela loja", mercadopago: "pelo Mercado Pago" };

const str = (n: number) => String(n).replace(".", ",");

export default function SubscriptionsAdminPage() {
  const { data, setData } = useAdminData<Data>("/api/admin/subscriptions");
  const subs = data?.subscriptions ?? [];
  const active = subs.filter((s) => s.status === "ativa");
  const upsert = (row: Row) => setData((d) => d && { ...d, subscriptions: d.subscriptions.map((s) => (s.id === row.id ? row : s)) });

  return (
    <>
      <PageTitle
        title="Assinaturas"
        subtitle={data ? `${active.length} ativa${active.length === 1 ? "" : "s"} • ${brl(active.reduce((sum, s) => sum + s.price, 0))} por mês` : undefined}
      />
      {!data ? (
        <div className="card h-96 animate-pulse" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr] lg:items-start">
          <PlanForm initial={data.plan} onSaved={(plan) => setData((d) => d && { ...d, plan })} />
          <section>
            <h2 className="mb-3 font-semibold">Assinantes</h2>
            {subs.length === 0 ? (
              <p className="card p-10 text-center text-muted">Nenhuma assinatura ainda.</p>
            ) : (
              <ul className="flex flex-col gap-2">{subs.map((s) => <SubscriberCard key={s.id} row={s} onChange={upsert} />)}</ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function PlanForm({ initial, onSaved }: { initial: SubscriptionPlan; onSaved: (p: SubscriptionPlan) => void }) {
  const [v, setV] = useState({
    enabled: initial.enabled,
    price: initial.price.toFixed(2).replace(".", ","),
    podLimit: initial.podLimit.toFixed(2).replace(".", ","),
    secondPodPercent: str(initial.secondPodPercent),
    minMonths: String(initial.minMonths),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof v, value: string | boolean) => setV((s) => ({ ...s, [k]: value }));
  const money = (s: string) => s.replace(/[^\d.,]/g, "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { plan } = await adminFetch<{ plan: SubscriptionPlan }>("/api/admin/subscriptions", { method: "PUT", body: JSON.stringify(v) });
      onSaved(plan);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setErrors((err as { errors?: Record<string, string> }).errors ?? { form: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-4 p-5" noValidate>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Assinatura na loja</p>
          <p className="text-xs text-muted">Desligada, ninguém novo assina. Quem já assina continua sendo cobrado.</p>
        </div>
        <Toggle checked={v.enabled} onChange={(x) => set("enabled", x)} label="Assinatura na loja" />
      </div>
      <Field label="Mensalidade (R$)" error={errors.price} hint="Vale para novas assinaturas. Quem já assina segue no valor contratado.">
        <input className="input" inputMode="decimal" value={v.price} onChange={(e) => set("price", money(e.target.value))} />
      </Field>
      <Field label="Valor máximo do pod do mês (R$)" error={errors.podLimit} hint="Pod mais caro que isso: o assinante paga só a diferença.">
        <input className="input" inputMode="decimal" value={v.podLimit} onChange={(e) => set("podLimit", money(e.target.value))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desconto no 2º pod (%)" error={errors.secondPodPercent} hint="0 = sem desconto.">
          <input className="input" inputMode="decimal" value={v.secondPodPercent} onChange={(e) => set("secondPodPercent", money(e.target.value))} />
        </Field>
        <Field label="Fidelidade (meses)" error={errors.minMonths} hint="0 = cancela quando quiser.">
          <input className="input" inputMode="numeric" value={v.minMonths} onChange={(e) => set("minMonths", e.target.value.replace(/\D/g, "").slice(0, 2))} />
        </Field>
      </div>
      <p className="text-xs text-muted">
        O pod do mês e o desconto só valem com a mensalidade paga, uma vez por mensalidade, e não acumulam com cupom. Durante a fidelidade o cliente não cancela pelo site; você pode cancelar aqui a qualquer momento.
      </p>
      {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}
      <button disabled={saving} className="btn-brand">
        {saving ? <Loader2 className="size-5 animate-spin" /> : saved ? <Check className="size-5" /> : <Save className="size-5" />} {saved ? "Salvo" : "Salvar plano"}
      </button>
    </form>
  );
}

function SubscriberCard({ row: s, onChange }: { row: Row; onChange: (r: Row) => void }) {
  const [busy, setBusy] = useState<"sync" | "cancel" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "sync" | "cancel") {
    setBusy(action);
    setError(null);
    try {
      onChange((await adminFetch<{ subscription: Row }>(`/api/admin/subscriptions/${s.id}`, { method: action === "sync" ? "POST" : "DELETE" })).subscription);
      setConfirming(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold">{s.customer?.name ?? "Cliente removido"}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[s.status].className}`}>{STATUS[s.status].label}</span>
        <span className="ml-auto font-semibold">{brl(s.price)}/mês</span>
      </div>
      <p className="mt-1 text-muted">
        {s.customer && <>{formatPhone(s.customer.phone)} • {s.customer.email} • </>}
        {s.card.brand}{s.card.last4 && ` •••• ${s.card.last4}`}
      </p>
      <p className="mt-1 text-muted">
        Desde {formatDate(s.createdAt)} • {s.paidMonths} de {s.minMonths} mensalidade{s.minMonths === 1 ? "" : "s"} da fidelidade paga{s.paidMonths === 1 ? "" : "s"}
        {s.status !== "cancelada" && s.nextChargeAt && <> • próxima cobrança {formatDate(s.nextChargeAt)}</>}
        {s.cancelledAt && <> • cancelada {BY[s.cancelledBy ?? "admin"]} em {formatDate(s.cancelledAt)}</>}
      </p>
      {s.benefit && (
        <p className="mt-1 text-muted">
          Neste mês: pod do mês {s.benefit.freePod ? "disponível" : "já usado"}
          {s.benefit.percent > 0 && <>, 2º pod {s.benefit.secondPod ? "disponível" : "já usado"}</>} (até {formatDate(s.benefit.endsAt)})
        </p>
      )}
      {s.cycles.some((c) => c.reversed) && <p className="mt-1 text-red-300">Tem mensalidade estornada ou contestada.</p>}
      {error && <p className="mt-2 text-red-400">{error}</p>}
      {s.status !== "cancelada" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => run("sync")} disabled={!!busy} className="btn-ghost px-3! py-2! text-xs">
            {busy === "sync" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Conferir no Mercado Pago
          </button>
          {confirming ? (
            <>
              <button onClick={() => run("cancel")} disabled={!!busy} className="btn-ghost border-red-500/40! px-3! py-2! text-xs text-red-300">
                {busy === "cancel" && <Loader2 className="size-3.5 animate-spin" />} Confirmar cancelamento
              </button>
              <button onClick={() => setConfirming(false)} className="btn-ghost px-3! py-2! text-xs">Voltar</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} className="btn-ghost px-3! py-2! text-xs text-red-300">Cancelar assinatura</button>
          )}
        </div>
      )}
    </li>
  );
}
