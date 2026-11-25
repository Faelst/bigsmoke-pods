"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { BadgePercent, CalendarClock, Check, CreditCard, Gift, Loader2, Lock, Repeat, ShieldCheck } from "lucide-react";
import { brl, formatDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { percentLabel } from "@/lib/subscription-pricing";
import type { SubscriptionPlan, SubscriptionStatus, SubscriptionView } from "@/lib/types";
import { CardForm, type CardFormHandle } from "../checkout/CardForm";

type Data = { plan: SubscriptionPlan; subscription: SubscriptionView | null };

const STATUS: Record<SubscriptionStatus, { label: string; className: string }> = {
  pendente: { label: "Confirmando pagamento", className: "bg-brand/15 text-brand" },
  ativa: { label: "Ativa", className: "bg-leaf/15 text-leaf" },
  suspensa: { label: "Mensalidade pendente", className: "bg-red-500/15 text-red-300" },
  cancelada: { label: "Cancelada", className: "bg-white/10 text-muted" },
};

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

export default function SubscriptionPage() {
  const { customer, loaded } = useSession();
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(
    () =>
      fetch("/api/subscription")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [loaded, customer?.id, load]);

  // A 1ª cobrança não é na hora: confere de tempos em tempos enquanto estiver pendente.
  const pending = data?.subscription?.status === "pendente";
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [pending, load]);

  if (!data) return <div className="mx-auto max-w-3xl px-4 pt-6"><div className="card h-72 animate-pulse" /></div>;
  const { plan, subscription } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-5 sm:p-7">
        <div className="absolute -right-10 -top-10 size-44 rounded-full bg-brand/20 blur-3xl" />
        <p className="relative flex items-center gap-2 text-sm font-semibold text-brand"><Repeat className="size-4" /> Assinatura Big Smoke</p>
        <h1 className="relative mt-2 font-display text-3xl">Seu pod todo mês</h1>
        <p className="relative mt-3 font-display text-4xl text-brand">
          {brl(subscription?.price ?? plan.price)} <span className="font-sans text-base text-muted">por mês</span>
        </p>
        <ul className="relative mt-5 flex flex-col gap-3 text-sm">
          <Perk icon={Gift} title="1 pod por mês, à sua escolha">
            Você paga só a entrega (ou retira no local sem custo). Vale para pods de até {brl(plan.podLimit)}; acima disso, só a diferença.
          </Perk>
          {plan.secondPodPercent > 0 && (
            <Perk icon={BadgePercent} title={`${percentLabel(plan.secondPodPercent)} de desconto no 2º pod do mês`}>
              O desconto entra sozinho no checkout quando você está logado.
            </Perk>
          )}
        </ul>
      </motion.section>

      {subscription ? (
        <Mine subscription={subscription} onChange={(s) => setData({ plan, subscription: s })} reload={load} />
      ) : !plan.enabled ? (
        <p className="card mt-5 p-6 text-center text-muted">A assinatura ainda não está disponível. Volte em breve!</p>
      ) : !customer ? (
        <div className="card mt-5 flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-muted">Para assinar, entre na sua conta ou crie uma em segundos.</p>
          <Link href="/entrar?next=/assinatura" className="btn-brand">Entrar para assinar</Link>
        </div>
      ) : (
        <Subscribe plan={plan} onDone={(s) => setData({ plan, subscription: s })} />
      )}

      <Rules plan={plan} />
    </div>
  );
}

function Perk({ icon: Icon, title, children }: { icon: typeof Gift; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><Icon className="size-5" /></span>
      <span><span className="block font-semibold">{title}</span><span className="text-muted">{children}</span></span>
    </li>
  );
}

function Rules({ plan }: { plan: SubscriptionPlan }) {
  return (
    <section className="mt-5 rounded-3xl border border-line p-5 text-sm text-muted">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-white"><ShieldCheck className="size-4 text-brand" /> Como funciona</h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        <li>A mensalidade é cobrada todo mês no cartão de crédito, automaticamente.</li>
        <li>A primeira cobrança leva até cerca de 1 hora para ser confirmada. Os benefícios são liberados quando ela for aprovada.</li>
        <li>Cada mensalidade paga dá direito a 1 pod do mês{plan.secondPodPercent > 0 && " e a 1 desconto de 2º pod"}, para usar em até 1 mês. O que não for usado não acumula.</li>
        <li>Os benefícios valem para pedidos feitos logado na conta do assinante e não acumulam com cupom.</li>
        {plan.minMonths > 0 && <li>Fidelidade de {plan.minMonths} mensalidade{plan.minMonths > 1 ? "s" : ""}: depois da primeira cobrança, o cancelamento pelo site fica disponível a partir da {plan.minMonths}ª mensalidade paga.</li>}
        <li>Cancelar interrompe as próximas cobranças. A mensalidade já paga não é devolvida e os benefícios seguem até o fim do mês pago.</li>
        <li>Mensalidade recusada, estornada ou contestada suspende os benefícios.</li>
      </ul>
    </section>
  );
}

function Subscribe({ plan, onDone }: { plan: SubscriptionPlan; onDone: (s: SubscriptionView) => void }) {
  const cardForm = useRef<CardFormHandle>(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const card = await cardForm.current!.tokenize();
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card, accepted, expectedPrice: plan.price }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível assinar");
      onDone(json.subscription);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <section className="card mt-5 p-5 sm:p-7">
      <h2 className="mb-5 flex items-center gap-2 font-semibold"><CreditCard className="size-5 text-brand" /> Cartão de crédito da assinatura</h2>
      <CardForm ref={cardForm} total={plan.price} />
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-[#ffb200]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>
          Li as regras abaixo e autorizo a cobrança de {brl(plan.price)} por mês neste cartão
          {plan.minMonths > 0 && <>, com fidelidade de {plan.minMonths} mensalidade{plan.minMonths > 1 ? "s" : ""}</>}.
        </span>
      </label>
      {error && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <button onClick={submit} disabled={!accepted || submitting} className="btn-brand mt-5 w-full text-lg">
        {submitting ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />} Assinar por {brl(plan.price)}/mês
      </button>
      <p className="mt-3 text-center text-xs text-muted">Pagamento processado com segurança pelo Mercado Pago. Ele pode fazer uma cobrança mínima de validação do cartão, devolvida em seguida.</p>
    </section>
  );
}

function Mine({ subscription: s, onChange, reload }: { subscription: SubscriptionView; onChange: (s: SubscriptionView) => void; reload: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = s.benefit;

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/subscription", { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setConfirming(false);
    if (!res.ok) return setError(json.error ?? "Não foi possível cancelar");
    onChange(json.subscription);
    reload();
  }

  return (
    <section className="card mt-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Minha assinatura</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[s.status].className}`}>{STATUS[s.status].label}</span>
      </div>

      {s.status === "pendente" && (
        <p className="mt-4 flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-4 text-sm">
          <Loader2 className="size-5 shrink-0 animate-spin text-brand" />
          Estamos confirmando a primeira cobrança no cartão. Isso leva até cerca de 1 hora; os benefícios aparecem aqui assim que ela for aprovada.
        </p>
      )}
      {s.status === "suspensa" && (
        <p className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          A mensalidade não foi paga. O Mercado Pago tenta de novo nos próximos dias; os benefícios voltam quando a cobrança for aprovada.
        </p>
      )}
      {s.status === "cancelada" && b && (
        <p className="mt-4 rounded-2xl border border-line bg-surface-2 p-4 text-sm text-muted">
          Assinatura cancelada: não haverá novas cobranças. Seus benefícios valem até {day(b.endsAt)}.
        </p>
      )}

      {b && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <Slot icon={Gift} title="Pod do mês" available={b.freePod} hint={`Use até ${day(b.endsAt)}`} />
          {b.percent > 0 && <Slot icon={BadgePercent} title={`2º pod com ${percentLabel(b.percent)}`} available={b.secondPod} hint={`Use até ${day(b.endsAt)}`} />}
        </ul>
      )}
      {b && (b.freePod || b.secondPod) && <Link href="/" className="btn-brand mt-4 w-full">Escolher meu pod</Link>}

      <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 text-sm text-muted">
        <p className="flex items-center gap-2"><CreditCard className="size-4" /> {s.card.brand}{s.card.last4 && ` •••• ${s.card.last4}`} • {brl(s.price)}/mês</p>
        {s.nextChargeAt && <p className="flex items-center gap-2"><CalendarClock className="size-4" /> Próxima cobrança: {day(s.nextChargeAt)}</p>}
        <p>Assinante desde {formatDate(s.createdAt)} • {s.paidMonths} mensalidade{s.paidMonths === 1 ? "" : "s"} paga{s.paidMonths === 1 ? "" : "s"}</p>
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {s.status !== "cancelada" &&
        (!s.canCancel ? (
          <p className="mt-4 text-xs text-muted">
            Fidelidade: o cancelamento pelo site fica disponível depois de mais {s.cancelAfterMonths} mensalidade{s.cancelAfterMonths > 1 ? "s" : ""} paga{s.cancelAfterMonths > 1 ? "s" : ""}.
          </p>
        ) : confirming ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 p-4 text-sm">
            <p>Cancelar a assinatura? As próximas cobranças param, a mensalidade já paga não é devolvida e os benefícios seguem até o fim do mês pago.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirming(false)} className="btn-ghost py-2.5! text-xs">Manter assinatura</button>
              <button onClick={cancel} disabled={busy} className="btn-ghost border-red-500/40! py-2.5! text-xs text-red-300">
                {busy && <Loader2 className="size-3.5 animate-spin" />} Cancelar assinatura
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="mt-4 text-sm text-muted underline-offset-4 hover:text-white hover:underline">Cancelar assinatura</button>
        ))}
    </section>
  );
}

function Slot({ icon: Icon, title, available, hint }: { icon: typeof Gift; title: string; available: boolean; hint: string }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl border p-3 text-sm ${available ? "border-leaf/40 bg-leaf/5" : "border-line bg-surface-2 opacity-70"}`}>
      <Icon className={`size-5 shrink-0 ${available ? "text-leaf" : "text-muted"}`} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="text-xs text-muted">{available ? hint : "Já usado neste mês"}</span>
      </span>
      {!available && <Check className="size-4 text-muted" />}
    </li>
  );
}
