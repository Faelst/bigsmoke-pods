"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeDollarSign, Loader2, Pencil, Percent, Plus, Ticket, Trash2, Truck } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { couponLabel } from "@/lib/coupon-pricing";
import type { AdminCoupon, CouponKind } from "@/lib/types";
import { Field, PageTitle, Sheet, Toggle } from "@/components/admin/ui";

// Hoje em Brasília (AAAA-MM-DD), para comparar com a validade.
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const formatDate = (ymd: string) => ymd.split("-").reverse().join("/");
const expired = (c: AdminCoupon) => today() > c.validUntil;
const soldOut = (c: AdminCoupon) => c.maxUses > 0 && c.used + c.reserved >= c.maxUses;

export default function CouponsAdminPage() {
  const { data, setData } = useAdminData<{ coupons: AdminCoupon[] }>("/api/admin/coupons");
  const [editing, setEditing] = useState<AdminCoupon | "new" | null>(null);

  const upsert = (c: AdminCoupon) =>
    setData((d) => d && { coupons: d.coupons.some((x) => x.id === c.id) ? d.coupons.map((x) => (x.id === c.id ? c : x)) : [c, ...d.coupons] });

  async function toggle(c: AdminCoupon) {
    upsert({ ...c, active: !c.active });
    try {
      upsert((await adminFetch<{ coupon: AdminCoupon }>(`/api/admin/coupons/${c.id}`, { method: "PATCH", body: JSON.stringify({ active: !c.active }) })).coupon);
    } catch {
      upsert(c);
    }
  }

  const coupons = data?.coupons ?? [];
  return (
    <>
      <PageTitle
        title="Cupons"
        subtitle={data ? `${coupons.filter((c) => c.active && !expired(c)).length} valendo de ${coupons.length}` : undefined}
        action={
          <button onClick={() => setEditing("new")} className="btn-brand py-2.5!">
            <Plus className="size-4" /> Novo cupom
          </button>
        }
      />

      <ul className="grid gap-2 md:grid-cols-2">
        {!data && [0, 1].map((i) => <li key={i} className="card h-24 animate-pulse" />)}
        <AnimatePresence initial={false}>
          {coupons.map((c) => {
            const Icon = KIND_ICON[c.kind];
            const status = !c.active ? "Desligado" : expired(c) ? "Expirado" : soldOut(c) ? "Esgotado" : null;
            return (
              <motion.li key={c.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`card flex min-w-0 items-center gap-3 p-3 ${status ? "opacity-60" : ""}`}>
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><Icon className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-mono font-semibold">
                    {c.code}
                    {status && <span className="rounded bg-line px-1.5 py-0.5 font-sans text-[10px] uppercase">{status}</span>}
                  </p>
                  <p className="truncate text-sm text-muted">{couponLabel(c)} • até {formatDate(c.validUntil)}</p>
                  <p className="truncate text-xs text-muted">
                    {c.used}{c.maxUses > 0 ? `/${c.maxUses}` : ""} usos
                    {c.reserved > 0 && <span className="text-brand"> (+{c.reserved} reservado{c.reserved > 1 ? "s" : ""} em PIX)</span>}
                    {" • "}{c.maxPerPhone > 0 ? `${c.maxPerPhone}x por WhatsApp` : "sem limite por WhatsApp"}
                  </p>
                </div>
                <Toggle checked={c.active} onChange={() => toggle(c)} label={c.active ? "Desligar cupom" : "Ligar cupom"} />
                <button onClick={() => setEditing(c)} aria-label={`Editar ${c.code}`} className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 hover:text-brand">
                  <Pencil className="size-4" />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {data && coupons.length === 0 && (
        <div className="card mt-4 flex flex-col items-center gap-2 p-10 text-center text-muted">
          <Ticket className="size-10 text-line" />
          Nenhum cupom ainda. Crie um de frete grátis, de desconto em % ou em R$.
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Novo cupom" : "Editar cupom"}>
        {editing && (
          <CouponForm
            key={editing === "new" ? "new" : editing.id}
            coupon={editing === "new" ? null : editing}
            onSaved={(c) => {
              upsert(c);
              setEditing(null);
            }}
            onDeleted={(id) => {
              setData((d) => d && { coupons: d.coupons.filter((x) => x.id !== id) });
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

const KIND_ICON: Record<CouponKind, typeof Truck> = { free_shipping: Truck, percent: Percent, fixed: BadgeDollarSign };

const KINDS: { id: CouponKind; label: string }[] = [
  { id: "free_shipping", label: "Frete grátis" },
  { id: "percent", label: "Desconto em %" },
  { id: "fixed", label: "Desconto em R$" },
];

function CouponForm({ coupon, onSaved, onDeleted }: { coupon: AdminCoupon | null; onSaved: (c: AdminCoupon) => void; onDeleted: (id: string) => void }) {
  const [v, setV] = useState({
    code: coupon?.code ?? "",
    kind: coupon?.kind ?? ("percent" as CouponKind),
    percent: coupon?.percent ? String(coupon.percent) : "10",
    amount: coupon?.amount ? coupon.amount.toFixed(2).replace(".", ",") : "10,00",
    validUntil: coupon?.validUntil ?? "",
    maxUses: coupon ? String(coupon.maxUses || "") : "",
    maxPerPhone: coupon ? String(coupon.maxPerPhone || "") : "1",
    active: coupon?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof typeof v, value: string | boolean) => setV((s) => ({ ...s, [k]: value }));
  const digits = (s: string) => s.replace(/\D/g, "").slice(0, 6);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { percent, amount, ...rest } = v;
      const payload = { ...rest, ...(v.kind === "percent" && { percent }), ...(v.kind === "fixed" && { amount }) };
      const { coupon: saved } = await adminFetch<{ coupon: AdminCoupon }>(coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons", {
        method: coupon ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      onSaved(saved);
    } catch (err) {
      setErrors((err as { errors?: Record<string, string> }).errors ?? { form: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!coupon) return;
    setSaving(true);
    await adminFetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" }).catch(() => {});
    onDeleted(coupon.id);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Field label="Código" error={errors.code} hint="O que o cliente digita no checkout. Maiúsculas e minúsculas tanto faz.">
        <input className="input font-mono uppercase" value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="FRETEGRATIS" maxLength={30} />
      </Field>

      <Field label="Tipo" error={errors.kind}>
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-surface-2 p-1.5">
          {KINDS.map(({ id, label }) => {
            const Icon = KIND_ICON[id];
            return (
            <button
              key={id}
              type="button"
              onClick={() => set("kind", id)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2.5 text-xs font-semibold transition sm:flex-row sm:gap-2 sm:text-sm ${v.kind === id ? "text-black" : "text-muted"}`}
            >
              {v.kind === id && <motion.span layoutId="coupon-kind" className="absolute inset-0 rounded-xl bg-brand" />}
              <Icon className="relative size-4" />
              <span className="relative text-center leading-tight">{label}</span>
            </button>
            );
          })}
        </div>
      </Field>

      {v.kind === "percent" ? (
        <Field label="Desconto (%)" error={errors.percent} hint="Vale sobre o valor dos produtos, sem o frete.">
          <input className="input" inputMode="decimal" value={v.percent} onChange={(e) => set("percent", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="10" />
        </Field>
      ) : v.kind === "fixed" ? (
        <Field label="Desconto (R$)" error={errors.amount} hint="Abatido do valor dos produtos, sem o frete. Nunca passa do valor dos produtos.">
          <input className="input" inputMode="decimal" value={v.amount} onChange={(e) => set("amount", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="10,00" />
        </Field>
      ) : (
        <p className="-mt-2 text-xs text-muted">Zera a entrega. Não libera endereços fora do raio de entrega da loja.</p>
      )}

      <Field label="Válido até (inclusive)" error={errors.validUntil}>
        <input className="input" type="date" value={v.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Limite de usos" error={errors.maxUses} hint="Total de pedidos. Vazio = sem limite.">
          <input className="input" inputMode="numeric" value={v.maxUses} onChange={(e) => set("maxUses", digits(e.target.value))} placeholder="Sem limite" />
        </Field>
        <Field label="Usos por WhatsApp" error={errors.maxPerPhone} hint="Por número de WhatsApp do pedido. Vazio = sem limite.">
          <input className="input" inputMode="numeric" value={v.maxPerPhone} onChange={(e) => set("maxPerPhone", digits(e.target.value))} placeholder="Sem limite" />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
        <div>
          <p className="font-semibold">Cupom ligado</p>
          <p className="text-xs text-muted">Desligue para pausar sem excluir</p>
        </div>
        <Toggle checked={v.active} onChange={(x) => set("active", x)} label="Cupom ligado" />
      </div>

      <p className="text-xs text-muted">
        Um PIX gerado reserva o uso por até 30 minutos; ele só conta de vez quando o pagamento é confirmado. PIX expirado ou pedido cancelado libera o uso.
        Só um cupom por pedido.
      </p>
      {coupon && (coupon.used > 0 || coupon.reserved > 0) && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
          Já usado em <span className="font-semibold text-white">{coupon.used}</span> pedido{coupon.used === 1 ? "" : "s"}
          {coupon.reserved > 0 && <> e reservado em {coupon.reserved} PIX aguardando pagamento</>}.
        </p>
      )}
      {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}

      <button disabled={saving} className="btn-brand">
        {saving && <Loader2 className="size-5 animate-spin" />} {coupon ? "Salvar alterações" : "Criar cupom"}
      </button>

      {coupon && (
        <div className="border-t border-line pt-4">
          <AnimatePresence mode="wait" initial={false}>
            {confirmDelete ? (
              <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost text-sm">Cancelar</button>
                <button type="button" onClick={remove} className="btn-ghost border-red-500/50! bg-red-500/15! text-sm text-red-300">Excluir de vez</button>
              </motion.div>
            ) : (
              <motion.button key="ask" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-center gap-2 py-2 text-sm text-red-300 hover:text-red-200">
                <Trash2 className="size-4" /> Excluir cupom
              </motion.button>
            )}
          </AnimatePresence>
          <p className="mt-1 text-center text-xs text-muted">Os pedidos que já usaram o cupom continuam mostrando o desconto.</p>
        </div>
      )}
    </form>
  );
}
