"use client";

import { useState } from "react";
import { Check, Clock, Copy, Loader2, Moon, Save, Share2, Sun } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { formatOpening, storeStatus, WEEKDAYS } from "@/lib/hours";
import type { DayHours, SocialLinks, StoreSettings } from "@/lib/types";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";
import { Field, PageTitle, Toggle } from "@/components/admin/ui";

export default function StoreAdminPage() {
  const { data } = useAdminData<{ settings: StoreSettings }>("/api/admin/settings");
  return (
    <>
      <PageTitle title="Loja" subtitle="Horário de funcionamento e redes sociais" />
      {data ? <StoreForm initial={data.settings} /> : <div className="card h-96 animate-pulse" />}
    </>
  );
}

function StoreForm({ initial }: { initial: StoreSettings }) {
  const [hours, setHours] = useState<DayHours[]>(initial.hours);
  const [social, setSocial] = useState<SocialLinks>(initial.social);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [closedUntil, setClosedUntil] = useState(initial.closedUntil ?? null);
  const [toggling, setToggling] = useState(false);
  const status = storeStatus(hours, new Date(), closedUntil);
  const payload = JSON.stringify({ hours, social });
  const [savedPayload, setSavedPayload] = useState(payload);
  const dirty = payload !== savedPayload;

  async function toggleClosed() {
    setToggling(true);
    try {
      const { settings } = await adminFetch<{ settings: StoreSettings }>("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ closed: !status.manual }) });
      setClosedUntil(settings.closedUntil ?? null);
    } catch (e) {
      setErrors({ form: (e as Error).message });
    } finally {
      setToggling(false);
    }
  }

  const setDay = (i: number, patch: Partial<DayHours>) => setHours(hours.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const { settings } = await adminFetch<{ settings: StoreSettings }>("/api/admin/settings", { method: "PUT", body: payload });
      setSocial(settings.social);
      setSavedPayload(JSON.stringify({ hours, social: settings.social }));
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
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><Clock className="size-5 text-brand" /> Horário de funcionamento</h2>
        <p className="mb-4 text-sm text-muted">
          Horário de Brasília. Fora do horário o cliente ainda pode comprar: o pedido vira encomenda, enviada quando a loja abrir (a tarifa dinâmica das encomendas é definida em Entrega).
        </p>
        <div className={`mb-4 flex items-center gap-3 rounded-2xl p-3 ${status.open ? "bg-leaf/10" : "bg-brand/10"}`}>
          <div className="min-w-0 flex-1 text-sm">
            <p className={`font-semibold ${status.open ? "text-leaf" : "text-brand"}`}>
              {status.open ? "Aberta agora" : status.manual ? "Fechada manualmente" : "Fechada pelo horário"}
            </p>
            <p className="text-muted">
              {status.opensAt ? `Reabre sozinha ${formatOpening(status.opensAt)}` : status.open ? "Seguindo o horário de funcionamento" : "Nenhum dia aberto na agenda"}
            </p>
          </div>
          {(status.open || status.manual) && (
            <button onClick={toggleClosed} disabled={toggling} className="btn-ghost shrink-0 py-2! text-xs">
              {toggling ? <Loader2 className="size-4 animate-spin" /> : status.manual ? <Sun className="size-4 text-leaf" /> : <Moon className="size-4 text-brand" />}
              {status.manual ? "Reabrir agora" : "Fechar agora"}
            </button>
          )}
        </div>
        {status.open && <p className="-mt-2 mb-4 text-xs text-muted">&quot;Fechar agora&quot; fecha a loja até o próximo horário de abertura da agenda; depois ela abre sozinha.</p>}
        <ul className="flex flex-col divide-y divide-line">
          {hours.map((h, i) => (
            <li key={i} className="py-3">
              <div className="flex items-center gap-3">
                <Toggle checked={h.open} onChange={(open) => setDay(i, { open })} label={`Abrir ${WEEKDAYS[i]}`} />
                <span className="w-16 text-sm font-medium capitalize">{WEEKDAYS[i]}</span>
                {h.open ? (
                  <div className="ml-auto flex items-center gap-2">
                    <input type="time" aria-label="Abre" className="input w-28 px-3! py-2!" value={h.start} onChange={(e) => setDay(i, { start: e.target.value })} />
                    <span className="text-sm text-muted">às</span>
                    <input type="time" aria-label="Fecha" className="input w-28 px-3! py-2!" value={h.end} onChange={(e) => setDay(i, { end: e.target.value })} />
                  </div>
                ) : (
                  <span className="ml-auto text-sm text-muted">Fechado</span>
                )}
              </div>
              {h.open && h.start === h.end && <p className="mt-1 text-right text-xs text-muted">Aberto 24 horas</p>}
              {h.open && h.end < h.start && <p className="mt-1 text-right text-xs text-muted">Fecha às {h.end} do dia seguinte</p>}
              {errors[`day${i}`] && <p className="mt-1 text-right text-sm text-red-400">{errors[`day${i}`]}</p>}
            </li>
          ))}
        </ul>
        <button onClick={() => setHours(hours.map(() => ({ ...hours[1] })))} className="btn-ghost mt-3 w-full py-2.5! text-sm">
          <Copy className="size-4 text-brand" /> Copiar horário de segunda para todos os dias
        </button>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><Share2 className="size-5 text-brand" /> Redes sociais</h2>
        <p className="mb-4 text-sm text-muted">Aparecem no topo, no rodapé, no botão flutuante e nas mensagens de pedido.</p>
        <div className="flex flex-col gap-3">
          <Field label="WhatsApp" hint="DDD + número, ex.: (12) 99619-0474" error={errors.whatsapp}>
            <IconInput icon={<WhatsAppIcon className="size-5 text-[#25D366]" />} value={social.whatsapp} inputMode="tel" onChange={(whatsapp) => setSocial({ ...social, whatsapp })} />
          </Field>
          <Field label="Instagram" hint="Perfil (@usuario) ou link" error={errors.instagram}>
            <IconInput icon={<InstagramIcon className="size-5 text-[#e1306c]" />} value={social.instagram} onChange={(instagram) => setSocial({ ...social, instagram })} />
          </Field>
          <Field label="TikTok" hint="Opcional — deixe vazio para esconder" error={errors.tiktok}>
            <IconInput icon={<TikTokIcon className="size-5" />} value={social.tiktok} onChange={(tiktok) => setSocial({ ...social, tiktok })} />
          </Field>
        </div>
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

function IconInput({ icon, value, onChange, inputMode }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; inputMode?: "tel" }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">{icon}</span>
      <input className="input pl-12!" inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} />
    </span>
  );
}
