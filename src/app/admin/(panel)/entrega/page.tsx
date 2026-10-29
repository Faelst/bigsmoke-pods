"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bike, Car, Check, Crosshair, Loader2, MapPin, Route, Save } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { deliveryFee, UBER_PRESETS } from "@/lib/delivery-pricing";
import { brl } from "@/lib/format";
import type { Address, DeliveryPricing, DeliverySettings, GeoPoint } from "@/lib/types";
import { AddressFields, EMPTY_ADDRESS, isAddressComplete } from "@/components/AddressFields";
import { Field, PageTitle } from "@/components/admin/ui";

type PricingForm = Record<keyof DeliveryPricing, string>;

const PRICING_FIELDS: { key: keyof DeliveryPricing; label: string; hint?: string; unit: "R$" | "km" }[] = [
  { key: "base", label: "Tarifa base", unit: "R$" },
  { key: "perKm", label: "Preço por km", unit: "R$" },
  { key: "perMin", label: "Preço por minuto", unit: "R$" },
  { key: "minimum", label: "Valor mínimo", unit: "R$" },
  { key: "extra", label: "Taxa adicional da loja", hint: "Somada a toda entrega (embalagem, margem…)", unit: "R$" },
  { key: "freeAbove", label: "Frete grátis acima de", hint: "0 = desligado", unit: "R$" },
  { key: "maxKm", label: "Raio máximo de entrega", unit: "km" },
];

const toForm = (p: DeliveryPricing) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v).replace(".", ",")])) as PricingForm;
const fromForm = (f: PricingForm) =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Number(v.replace(",", ".")) || 0])) as DeliveryPricing;

// Tempo estimado nos exemplos (a cotação real usa a rota pelas ruas).
const AVG_KMH = 25;

export default function DeliveryAdminPage() {
  const { data } = useAdminData<{ delivery: DeliverySettings }>("/api/admin/delivery");
  return (
    <>
      <PageTitle title="Entrega" subtitle="Localização da loja e tabela de frete no modelo Uber Flash" />
      {data ? <DeliveryForm initial={data.delivery} /> : <div className="card h-96 animate-pulse" />}
    </>
  );
}

function DeliveryForm({ initial }: { initial: DeliverySettings }) {
  const [address, setAddress] = useState<Address>(initial.store ?? EMPTY_ADDRESS);
  const [point, setPoint] = useState<GeoPoint | null>(initial.store && { lat: initial.store.lat, lng: initial.store.lng });
  const [pricing, setPricing] = useState<PricingForm>(toForm(initial.pricing));
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const values = fromForm(pricing);

  async function locate() {
    setLocating(true);
    setErrors({});
    try {
      const { point } = await adminFetch<{ point: GeoPoint }>("/api/admin/delivery/geocode", { method: "POST", body: JSON.stringify({ address }) });
      setPoint(point);
    } catch (e) {
      const err = e as Error & { errors?: Record<string, string> };
      setErrors(err.errors ?? { location: err.message });
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      await adminFetch("/api/admin/delivery", { method: "PUT", body: JSON.stringify({ store: { ...address, ...point }, pricing: values }) });
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
      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><MapPin className="size-5 text-brand" /> Localização da loja</h2>
        <AddressFields
          value={address}
          onChange={(a) => {
            setAddress(a);
            setPoint(null);
          }}
          errors={errors}
        />
        <button onClick={locate} disabled={!isAddressComplete(address) || locating} className="btn-ghost mt-4 w-full">
          {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4 text-brand" />}
          {point ? "Localizar novamente" : "Localizar no mapa"}
        </button>
        {errors.location && <p className="mt-2 text-sm text-red-400">{errors.location}</p>}

        <AnimatePresence>
          {point && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <iframe
                title="Mapa da loja"
                className="mt-4 h-56 w-full rounded-2xl border border-line [filter:invert(.9)_hue-rotate(180deg)_saturate(.6)]"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${point.lng - 0.008},${point.lat - 0.005},${point.lng + 0.008},${point.lat + 0.005}&layer=mapnik&marker=${point.lat},${point.lng}`}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(["lat", "lng"] as const).map((k) => (
                  <Field key={k} label={k === "lat" ? "Latitude" : "Longitude"}>
                    <input
                      className="input font-mono text-sm"
                      inputMode="decimal"
                      value={point[k]}
                      onChange={(e) => setPoint({ ...point, [k]: Number(e.target.value) || 0 })}
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">Se o pino não ficou no lugar certo, ajuste as coordenadas (copie do Google Maps clicando no local).</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="flex flex-col gap-5">
        <section className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Route className="size-5 text-brand" /> Tabela de preço</h2>
          <p className="mb-4 text-sm text-muted">
            Frete = tarifa base + (km × preço/km) + (minutos × preço/min), nunca abaixo do mínimo, + taxa adicional.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(Object.entries(UBER_PRESETS) as [keyof typeof UBER_PRESETS, (typeof UBER_PRESETS)[keyof typeof UBER_PRESETS]][]).map(([id, p]) => (
              <button
                key={id}
                onClick={() => setPricing({ ...toForm(p.pricing), extra: pricing.extra, freeAbove: pricing.freeAbove })}
                className="btn-ghost py-2.5! text-xs"
              >
                {id === "moto" ? <Bike className="size-4 text-brand" /> : <Car className="size-4 text-brand" />} Usar {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PRICING_FIELDS.map(({ key, label, hint, unit }) => (
              <Field key={key} label={label} hint={hint} error={errors[key]}>
                <span className="relative block">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
                  <input
                    className="input pl-11!"
                    inputMode="decimal"
                    value={pricing[key]}
                    onChange={(e) => setPricing({ ...pricing, [key]: e.target.value.replace(/[^\d.,]/g, "") })}
                  />
                </span>
              </Field>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Valores iniciais baseados em tarifas públicas da Uber Flash — confira no app da Uber (aba Entrega) os preços atuais da sua cidade.
          </p>

          <h3 className="mb-2 mt-5 text-sm font-semibold text-muted">Exemplos (≈{AVG_KMH} km/h)</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="pb-2 font-medium">Distância</th><th className="pb-2 font-medium">Tempo</th><th className="pb-2 text-right font-medium">Frete</th></tr>
            </thead>
            <tbody>
              {[2, 5, 8, 12].map((km) => {
                const min = (km / AVG_KMH) * 60;
                const out = km > values.maxKm;
                return (
                  <tr key={km} className="border-t border-line">
                    <td className="py-2">{km} km</td>
                    <td className="py-2 text-muted">{Math.round(min)} min</td>
                    <td className="py-2 text-right font-semibold">{out ? <span className="text-muted">Fora do raio</span> : brl(deliveryFee(values, km, min).fee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <Simulator from={point} pricing={values} />
      </div>

      {/* Barra de salvar */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-bg/90 p-3 backdrop-blur-xl lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
          {(errors.form || (Object.keys(errors).length > 0 && !errors.location)) && (
            <p className="text-sm text-red-400">{errors.form ?? "Revise os campos destacados"}</p>
          )}
          {errors.location && <p className="text-sm text-red-400">{errors.location}</p>}
          <button onClick={save} disabled={saving} className="btn-brand py-2.5!">
            {saving ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
            {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Simulator({ from, pricing }: { from: GeoPoint | null; pricing: DeliveryPricing }) {
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [result, setResult] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simulate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await adminFetch("/api/admin/delivery/simulate", { method: "POST", body: JSON.stringify({ from, address }) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const quote = result && deliveryFee(pricing, result.distanceKm, result.durationMin);
  return (
    <section className="card p-5">
      <h2 className="mb-1 font-semibold">Simular entrega</h2>
      <p className="mb-4 text-sm text-muted">Teste o valor que o cliente vai pagar para um endereço.</p>
      <AddressFields
        value={address}
        onChange={(a) => {
          setAddress(a);
          setResult(null);
        }}
      />
      <button onClick={simulate} disabled={!from || !isAddressComplete(address) || loading} className="btn-ghost mt-4 w-full">
        {loading && <Loader2 className="size-4 animate-spin" />} {from ? "Calcular frete" : "Localize a loja primeiro"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {result && quote && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Distância" value={`${quote.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`} />
          <Stat label="Trajeto" value={`${quote.durationMin} min`} />
          <Stat label="Frete" value={result.distanceKm > pricing.maxKm ? "Fora do raio" : brl(quote.fee)} highlight />
        </motion.div>
      )}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 font-semibold ${highlight ? "text-brand" : ""}`}>{value}</p>
    </div>
  );
}
