"use client";

import Image from "next/image";
import { useState } from "react";
import { motion } from "motion/react";
import { CreditCard, Loader2, Minus, Plus, QrCode, Trash2 } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { brl, formatPhone, onlyDigits } from "@/lib/format";
import type { ManualVia, Order, Product } from "@/lib/types";
import { Field } from "@/components/admin/ui";

type Line = { slug: string; flavor: string; qty: number };

const VIAS: { id: ManualVia; label: string; icon: typeof QrCode }[] = [
  { id: "pix", label: "PIX", icon: QrCode },
  { id: "card", label: "Cartão de crédito", icon: CreditCard },
];

// Lança uma venda feita por fora da loja: debita o estoque e entra na lista de pedidos.
export function ManualSaleForm<T extends Order>({ onCreated }: { onCreated: (order: T) => void }) {
  const { data } = useAdminData<{ products: Product[] }>("/api/admin/products");
  const [slug, setSlug] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [via, setVia] = useState<ManualVia>("pix");
  const [total, setTotal] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const products = data?.products ?? [];
  const product = products.find((p) => p.slug === slug);
  const inCart = (s: string, flavor: string) => lines.find((l) => l.slug === s && l.flavor === flavor)?.qty ?? 0;
  // Disponível agora: estoque menos o que está reservado em PIX e o que já entrou nesta venda.
  const left = (p: Product, flavor: string) => {
    const f = p.flavors.find((x) => x.name === flavor);
    return Math.max(0, (f?.stock ?? 0) - (f?.reserved ?? 0) - inCart(p.slug, flavor));
  };

  const change = (s: string, flavor: string, delta: number) =>
    setLines((ls) => {
      const qty = (ls.find((l) => l.slug === s && l.flavor === flavor)?.qty ?? 0) + delta;
      const rest = ls.filter((l) => !(l.slug === s && l.flavor === flavor));
      if (qty <= 0) return rest;
      return ls.some((l) => l.slug === s && l.flavor === flavor) ? ls.map((l) => (l.slug === s && l.flavor === flavor ? { ...l, qty } : l)) : [...rest, { slug: s, flavor, qty }];
    });

  const subtotal = lines.reduce((sum, l) => sum + (products.find((p) => p.slug === l.slug)?.price ?? 0) * l.qty, 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { order } = await adminFetch<{ order: T }>("/api/admin/orders", {
        method: "POST",
        body: JSON.stringify({ items: lines, via, total, name, phone }),
      });
      onCreated(order);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">
        Para vendas combinadas por fora (WhatsApp, PIX direto). Ao salvar, o estoque é baixado na hora e a venda entra no faturamento. Nada é cobrado e o cliente não recebe mensagem.
      </p>

      <Field label="Produto">
        <select className="input" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!data}>
          <option value="">{data ? "Escolha um produto" : "Carregando…"}</option>
          {products.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name} — {brl(p.price)}{p.active ? "" : " (desativado)"}
            </option>
          ))}
        </select>
      </Field>

      {product && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Toque no sabor para adicionar</span>
          <div className="flex flex-wrap gap-2">
            {product.flavors.map((f) => {
              const available = left(product, f.name);
              return (
                <button
                  key={f.name}
                  type="button"
                  disabled={available === 0}
                  onClick={() => change(product.slug, f.name, 1)}
                  className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-left text-sm transition hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="font-medium">{f.name}</span>
                  <span className="ml-2 text-xs text-muted">{available === 0 ? "sem estoque" : `${available} disp.`}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {lines.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
          {lines.map((l) => {
            const p = products.find((x) => x.slug === l.slug);
            if (!p) return null;
            return (
              <li key={l.slug + l.flavor} className="flex items-center gap-3 text-sm">
                <Image src={p.image} alt="" width={40} height={40} className="size-10 shrink-0 rounded-lg bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="truncate text-muted">{l.flavor} • {brl(p.price * l.qty)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" aria-label="Diminuir" onClick={() => change(l.slug, l.flavor, -1)} className="grid size-8 place-items-center rounded-lg bg-surface">
                    {l.qty === 1 ? <Trash2 className="size-4 text-red-300" /> : <Minus className="size-4" />}
                  </button>
                  <span className="w-6 text-center font-semibold tabular-nums">{l.qty}</span>
                  <button
                    type="button"
                    aria-label="Aumentar"
                    disabled={left(p, l.flavor) === 0}
                    onClick={() => change(l.slug, l.flavor, 1)}
                    className="grid size-8 place-items-center rounded-lg bg-surface disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Field label="Como o cliente pagou">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-surface-2 p-1.5">
          {VIAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setVia(id)}
              className={`relative flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition ${via === id ? "text-black" : "text-muted"}`}
            >
              {via === id && <motion.span layoutId="manual-via" className="absolute inset-0 rounded-xl bg-brand" />}
              <Icon className="relative size-4" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Valor recebido (R$)" hint="Deixe em branco para usar o preço do site. Preencha se combinou outro valor (desconto, entrega embutida).">
        <input
          className="input"
          inputMode="decimal"
          value={total}
          onChange={(e) => setTotal(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder={subtotal ? subtotal.toFixed(2).replace(".", ",") : "0,00"}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cliente (opcional)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" maxLength={80} />
        </Field>
        <Field label="WhatsApp (opcional)">
          <input
            className="input"
            type="tel"
            inputMode="numeric"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))}
            placeholder="(11) 99999-9999"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button disabled={saving || lines.length === 0} className="btn-brand">
        {saving && <Loader2 className="size-5 animate-spin" />} Lançar venda
      </button>
    </form>
  );
}
