"use client";

import { useState } from "react";
import { Check, Clock, Copy, Loader2, MessageCircle, Moon, Plus, Save, Send, Share2, Sun, Webhook, X } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { formatPhone } from "@/lib/format";
import { formatOpening, storeStatus, WEEKDAYS } from "@/lib/hours";
import type { DayHours, SocialLinks, StoreSettings } from "@/lib/types";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";
import { Field, PageTitle, Toggle } from "@/components/admin/ui";

export default function StoreAdminPage() {
  const { data } = useAdminData<{ settings: StoreSettings }>("/api/admin/settings");
  return (
    <>
      <PageTitle title="Loja" subtitle="Horário de funcionamento, redes sociais e avisos no WhatsApp" />
      {data ? <StoreForm initial={data.settings} /> : <div className="card h-96 animate-pulse" />}
    </>
  );
}

function StoreForm({ initial }: { initial: StoreSettings }) {
  const [hours, setHours] = useState<DayHours[]>(initial.hours);
  const [social, setSocial] = useState<SocialLinks>(initial.social);
  // Na tela, sem o 55 (DDD + número), como nos outros campos de telefone.
  const [team, setTeam] = useState<string[]>((initial.teamPhones ?? []).map((p) => p.replace(/^55/, "")));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [closedUntil, setClosedUntil] = useState(initial.closedUntil ?? null);
  const [toggling, setToggling] = useState(false);
  const status = storeStatus(hours, new Date(), closedUntil);
  const payload = JSON.stringify({ hours, social, teamPhones: team });
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
      const savedTeam = (settings.teamPhones ?? []).map((p) => p.replace(/^55/, ""));
      setTeam(savedTeam);
      setSavedPayload(JSON.stringify({ hours, social: settings.social, teamPhones: savedTeam }));
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

      <WhatsAppSection team={team} onChange={setTeam} errors={errors} dirty={dirty} />

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

type WaStatus = {
  configured: boolean;
  instance: string;
  secret: boolean;
  webhook?: { enabled: boolean; url?: string; ours: boolean };
  error?: string;
};

// Números da equipe (salvos com o resto da página) e a ligação com a instância da Evolution API.
function WhatsAppSection({ team, onChange, errors, dirty }: { team: string[]; onChange: (t: string[]) => void; errors: Record<string, string>; dirty: boolean }) {
  const { data: status, reload } = useAdminData<WaStatus>("/api/admin/whatsapp");
  const [busy, setBusy] = useState<"webhook" | "test" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rows = team.length ? team : [""];

  async function run(action: "webhook" | "test") {
    setBusy(action);
    setMsg(null);
    try {
      const r = await adminFetch<{ sent?: number }>("/api/admin/whatsapp", { method: "POST", body: JSON.stringify({ action }) });
      setMsg({ ok: true, text: action === "webhook" ? "Webhook conectado: a instância agora manda as mensagens para a loja." : `Teste enviado para ${r.sent} número(s).` });
      if (action === "webhook") reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5 lg:col-span-2">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><MessageCircle className="size-5 text-brand" /> WhatsApp da equipe</h2>
      <p className="mb-4 text-sm text-muted">
        Quando um pagamento é confirmado, estes números recebem o pedido e o endereço (numa mensagem separada, para copiar).
        Para despachar, respondam <code className="rounded bg-surface-2 px-1.5 py-0.5 text-white">/ras - CÓDIGO - link da corrida</code>: o pedido vai para
        &quot;Saiu para entrega&quot; e o cliente recebe o link.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <ul className="flex flex-col gap-2">
            {rows.map((phone, i) => (
              <li key={i}>
                <div className="flex items-center gap-2">
                  <input
                    className="input min-w-0 flex-1 py-2!"
                    inputMode="tel"
                    placeholder="(12) 99999-9999"
                    aria-label={`WhatsApp ${i + 1}`}
                    value={formatPhone(phone)}
                    onChange={(e) => onChange(rows.map((p, j) => (j === i ? e.target.value.replace(/\D/g, "").slice(0, 11) : p)))}
                  />
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    aria-label="Remover número"
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-red-400"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                {errors[`team${i}`] && <p className="mt-1 text-sm text-red-400">{errors[`team${i}`]}</p>}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onChange([...rows, ""])} className="btn-ghost mt-2 w-full py-2! text-sm">
            <Plus className="size-4 text-brand" /> Adicionar número
          </button>
          <p className="mt-1 text-xs text-muted">Só estes números podem usar o /ras. Salve a página depois de mudar.</p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
          {!status ? (
            <div className="h-24 animate-pulse rounded-xl bg-surface" />
          ) : !status.configured ? (
            <p className="text-muted">
              Integração desligada: configure <code>EVOLUTION_API_URL</code> e <code>EVOLUTION_API_KEY</code> no servidor (veja o README).
            </p>
          ) : (
            <>
              <p>Instância: <span className="font-semibold">{status.instance}</span></p>
              {status.error ? (
                <p className="text-red-300">Não foi possível falar com a Evolution API: {status.error}</p>
              ) : status.webhook?.ours && status.webhook.enabled ? (
                <p className="text-leaf">Webhook conectado a esta loja: o /ras está funcionando.</p>
              ) : (
                <p className="text-brand">Webhook não aponta para esta loja: os avisos saem, mas o /ras ainda não funciona.</p>
              )}
              {!status.secret && <p className="text-red-300">Falta WHATSAPP_WEBHOOK_SECRET no servidor para conectar o webhook.</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => run("webhook")} disabled={!!busy} className="btn-ghost py-2.5! text-xs">
                  {busy === "webhook" ? <Loader2 className="size-4 animate-spin" /> : <Webhook className="size-4 text-brand" />} Conectar webhook
                </button>
                <button onClick={() => run("test")} disabled={!!busy || dirty} title={dirty ? "Salve os números primeiro" : undefined} className="btn-ghost py-2.5! text-xs">
                  {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 text-brand" />} Enviar teste
                </button>
              </div>
            </>
          )}
          {msg && <p className={msg.ok ? "text-leaf" : "text-red-300"}>{msg.text}</p>}
        </div>
      </div>
    </section>
  );
}
