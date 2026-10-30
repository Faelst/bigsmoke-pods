"use client";

import { useState } from "react";
import { Calculator, Check, CreditCard, Layers, Loader2, Plus, QrCode, Save, Trash2 } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { brl } from "@/lib/format";
import { installmentOptions, MAX_INSTALLMENTS, maxInstallmentsFor, paymentFee } from "@/lib/payment-fees";
import type { PaymentFees } from "@/lib/types";
import { Field, PageTitle } from "@/components/admin/ui";

type TierForm = { minTotal: string; maxInstallments: string };

const str = (n: number) => String(n).replace(".", ",");
const num = (s: string) => Number(s.replace(",", ".")) || 0;
const fromForm = (pix: string, card: string[], tiers: TierForm[]): PaymentFees => ({
  pixPercent: num(pix),
  cardPercent: card.map(num),
  tiers: tiers.map((t) => ({ minTotal: num(t.minTotal), maxInstallments: Math.floor(num(t.maxInstallments)) })).sort((a, b) => a.minTotal - b.minTotal),
});

export default function PaymentsAdminPage() {
  const { data } = useAdminData<{ fees: PaymentFees }>("/api/admin/payments");
  return (
    <>
      <PageTitle title="Pagamentos" subtitle="Taxa de processamento do PIX e do cartão e parcelamento por valor da compra" />
      {data ? <FeesForm initial={data.fees} /> : <div className="card h-96 animate-pulse" />}
    </>
  );
}

function FeesForm({ initial }: { initial: PaymentFees }) {
  const [pix, setPix] = useState(str(initial.pixPercent));
  const [card, setCard] = useState(initial.cardPercent.map(str));
  const [tiers, setTiers] = useState<TierForm[]>(initial.tiers.map((t) => ({ minTotal: str(t.minTotal), maxInstallments: String(t.maxInstallments) })));
  const [sample, setSample] = useState("500");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const payload = JSON.stringify({ pixPercent: pix, cardPercent: card, tiers });
  const [savedPayload, setSavedPayload] = useState(payload);
  const dirty = payload !== savedPayload;

  const fees = fromForm(pix, card, tiers);
  const unlocked = Math.max(1, ...fees.tiers.map((t) => t.maxInstallments));
  const sampleTotal = num(sample);

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const res = await adminFetch<{ fees: PaymentFees }>("/api/admin/payments", { method: "PUT", body: payload });
      const next = { pixPercent: str(res.fees.pixPercent), cardPercent: res.fees.cardPercent.map(str), tiers: res.fees.tiers.map((t) => ({ minTotal: str(t.minTotal), maxInstallments: String(t.maxInstallments) })) };
      setPix(next.pixPercent);
      setCard(next.cardPercent);
      setTiers(next.tiers);
      setSavedPayload(JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      const err = e as Error & { errors?: Record<string, string> };
      setErrors(err.errors ?? { form: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 pb-24 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-5">
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><QrCode className="size-5 text-brand" /> PIX</h2>
          <p className="mb-4 text-sm text-muted">Porcentagem somada ao total do pedido (produtos + entrega). Use 0 para não cobrar taxa no PIX.</p>
          <Field label="Taxa de processamento do PIX" error={errors.pixPercent}>
            <PercentInput value={pix} onChange={setPix} />
          </Field>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Layers className="size-5 text-brand" /> Parcelamento por valor</h2>
          <p className="mb-4 text-sm text-muted">
            A partir de cada valor de compra o cliente pode parcelar em até X vezes. Abaixo da menor faixa, o cartão é só à vista (1x).
          </p>
          <ul className="flex flex-col gap-2">
            {tiers.map((t, i) => (
              <li key={i}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">A partir de</span>
                  <span className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">R$</span>
                    <input className="input py-2! pl-10!" inputMode="decimal" value={t.minTotal} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minTotal: e.target.value } : x)))} />
                  </span>
                  <span className="text-muted">até</span>
                  <select className="input w-24 appearance-none py-2!" value={t.maxInstallments} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, maxInstallments: e.target.value } : x)))}>
                    {Array.from({ length: MAX_INSTALLMENTS - 1 }, (_, k) => k + 2).map((n) => <option key={n} value={n}>{n}x</option>)}
                  </select>
                  <button onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="Remover faixa" className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-red-400">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {errors[`tier${i}`] && <p className="mt-1 text-sm text-red-400">{errors[`tier${i}`]}</p>}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              const last = fees.tiers.at(-1);
              setTiers([...tiers, { minTotal: str((last?.minTotal ?? 100) + 100), maxInstallments: String(Math.min((last?.maxInstallments ?? 1) + 1, MAX_INSTALLMENTS)) }]);
            }}
            className="btn-ghost mt-3 w-full py-2.5! text-sm"
          >
            <Plus className="size-4 text-brand" /> Adicionar faixa
          </button>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Calculator className="size-5 text-brand" /> Simular</h2>
          <p className="mb-4 text-sm text-muted">Como o cliente vê as opções para um pedido deste valor (com as configurações acima, mesmo antes de salvar).</p>
          <Field label="Total do pedido">
            <span className="relative block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">R$</span>
              <input className="input pl-11!" inputMode="decimal" value={sample} onChange={(e) => setSample(e.target.value)} />
            </span>
          </Field>
          {sampleTotal > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 text-sm">
              <li className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span>PIX</span>
                <span>{brl(paymentFee(fees, sampleTotal, "pix").total)}</span>
              </li>
              {installmentOptions(fees, sampleTotal).map((o) => (
                <li key={o.installments} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
                  <span>Cartão {o.installments}x de {brl(o.each)}</span>
                  <span className="text-muted">{o.fee > 0 ? `+${brl(o.fee)} · ` : ""}<span className="text-white">{brl(o.total)}</span></span>
                </li>
              ))}
            </ul>
          )}
          {sampleTotal > 0 && <p className="mt-2 text-xs text-muted">Até {maxInstallmentsFor(fees, sampleTotal)}x neste valor.</p>}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><CreditCard className="size-5 text-brand" /> Taxa do cartão por parcela</h2>
        <p className="mb-4 text-sm text-muted">
          Porcentagem sobre o total do pedido para cada número de parcelas (progressiva: quanto mais parcelas, maior a taxa). Parcelas acima de {unlocked}x não são liberadas por nenhuma faixa.
        </p>
        <ul className="flex flex-col divide-y divide-line">
          {card.map((v, i) => (
            <li key={i} className={`flex items-center gap-3 py-2.5 ${i + 1 > unlocked ? "opacity-40" : ""}`}>
              <span className="w-10 font-display">{i + 1}x</span>
              <span className="flex-1 text-xs text-muted">{i === 0 ? "À vista" : `Em ${i + 1} parcelas`}</span>
              <span className="w-32"><PercentInput value={v} onChange={(x) => setCard(card.map((c, j) => (j === i ? x : c)))} /></span>
              {errors[`card${i}`] && <span className="text-xs text-red-400">{errors[`card${i}`]}</span>}
            </li>
          ))}
        </ul>
      </section>

      {/* Barra de salvar */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-bg/90 p-3 backdrop-blur-xl lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
          {Object.keys(errors).length > 0 && <p className="text-sm text-red-400">{errors.form ?? "Revise os campos destacados"}</p>}
          {dirty && Object.keys(errors).length === 0 && <p className="text-sm text-brand">Alterações não salvas</p>}
          <button onClick={save} disabled={saving} className="btn-brand py-2.5!">
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PercentInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="relative block">
      <input className="input py-2! pr-9!" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">%</span>
    </span>
  );
}
