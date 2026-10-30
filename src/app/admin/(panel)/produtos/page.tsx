"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Flame, ImagePlus, Loader2, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { brl } from "@/lib/format";
import { filterProducts } from "@/lib/products";
import type { Product } from "@/lib/types";
import { Field, PageTitle, Sheet, Toggle } from "@/components/admin/ui";

type FlavorRow = { name: string; stock: string; reserved?: number };

const totalStock = (p: Product) => p.flavors.reduce((s, f) => s + f.stock, 0);
const totalReserved = (p: Product) => p.flavors.reduce((s, f) => s + (f.reserved ?? 0), 0);

const TAGS = [
  { key: "bestseller", label: "Mais vendido", hint: "Selo e filtro “Mais vendidos” na loja", icon: Flame, on: "bg-brand text-black" },
  { key: "isNew", label: "Novidade", hint: "Selo e filtro “Novidades” na loja", icon: Sparkles, on: "bg-leaf text-black" },
] as const;

export default function ProductsAdminPage() {
  const { data, setData } = useAdminData<{ products: Product[] }>("/api/admin/products");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const products = useMemo(() => filterProducts(data?.products ?? [], q), [data, q]);

  const upsert = (p: Product) =>
    setData((d) => d && { products: d.products.some((x) => x.id === p.id) ? d.products.map((x) => (x.id === p.id ? p : x)) : [p, ...d.products] });

  // Atualização otimista de um campo booleano (visível, mais vendido, novidade).
  async function toggle(p: Product, key: "active" | "bestseller" | "isNew") {
    upsert({ ...p, [key]: !p[key] });
    try {
      upsert((await adminFetch<{ product: Product }>(`/api/admin/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ [key]: !p[key] }) })).product);
    } catch {
      upsert(p);
    }
  }

  return (
    <>
      <PageTitle
        title="Produtos"
        subtitle={data ? `${data.products.filter((p) => p.active).length} ativos de ${data.products.length}` : undefined}
        action={
          <button onClick={() => setEditing("new")} className="btn-brand py-2.5!">
            <Plus className="size-4" /> Novo produto
          </button>
        }
      />
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input className="input pl-12!" placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {!data && [0, 1, 2, 3].map((i) => <li key={i} className="card h-24 animate-pulse" />)}
        <AnimatePresence initial={false}>
          {products.map((p) => (
            <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className={`card flex min-w-0 items-center gap-3 p-3 ${p.active ? "" : "opacity-60"}`}>
              <Image src={p.image} alt="" width={64} height={64} className="size-16 shrink-0 rounded-xl bg-white object-contain" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-leaf">{p.brand}</p>
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-sm text-muted">
                  <span className="font-semibold text-brand">{brl(p.price)}</span> • {p.flavors.length} sabores •{" "}
                  {totalStock(p) > 0 ? `${totalStock(p)} em estoque` : <span className="text-red-400">sem estoque</span>}
                  {totalReserved(p) > 0 && <span className="text-brand"> ({totalReserved(p)} reservado{totalReserved(p) > 1 ? "s" : ""})</span>}
                  {!p.active && <span className="ml-1 rounded bg-line px-1.5 py-0.5 text-[10px] uppercase">Oculto</span>}
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  {TAGS.map(({ key, label, icon: Icon, on }) => (
                    <button
                      key={key}
                      onClick={() => toggle(p, key)}
                      aria-pressed={!!p[key]}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${p[key] ? on : "bg-surface-2 text-muted hover:text-white"}`}
                    >
                      <Icon className="size-3" /> {label}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle checked={p.active} onChange={() => toggle(p, "active")} label={p.active ? "Ocultar da loja" : "Mostrar na loja"} />
              <button onClick={() => setEditing(p)} aria-label={`Editar ${p.name}`} className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 hover:text-brand">
                <Pencil className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {data && products.length === 0 && <p className="card mt-4 p-10 text-center text-muted">Nenhum produto encontrado.</p>}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Novo produto" : "Editar produto"}>
        {editing && (
          <ProductForm
            key={editing === "new" ? "new" : editing.id}
            product={editing === "new" ? null : editing}
            onSaved={(p) => {
              upsert(p);
              setEditing(null);
            }}
            onDeleted={(id) => {
              setData((d) => d && { products: d.products.filter((x) => x.id !== id) });
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function ProductForm({ product, onSaved, onDeleted }: { product: Product | null; onSaved: (p: Product) => void; onDeleted: (id: string) => void }) {
  const [v, setV] = useState({
    name: product?.name ?? "",
    brand: product?.brand ?? "",
    price: product ? String(product.price) : "",
    puffs: product?.puffs ?? "",
    capacity: product?.capacity ?? "",
    description: product?.description ?? "",
    image: product?.image ?? "",
    badge: product?.badge ?? "",
    bestseller: product?.bestseller ?? false,
    isNew: product?.isNew ?? false,
    active: product?.active ?? true,
  });
  const [flavors, setFlavors] = useState<FlavorRow[]>(
    product?.flavors.map((f) => ({ name: f.name, stock: String(f.stock), reserved: f.reserved })) ?? [{ name: "", stock: "" }],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof v, value: string | boolean) => setV((s) => ({ ...s, [k]: value }));

  async function upload(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    try {
      set("image", (await adminFetch<{ url: string }>("/api/admin/uploads", { method: "POST", body })).url);
      setErrors((e) => ({ ...e, image: "" }));
    } catch (e) {
      setErrors((x) => ({ ...x, image: (e as Error).message }));
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...v, price: Number(v.price.replace(",", ".")), flavors: flavors.map(({ name, stock }) => ({ name, stock })) };
      const { product: saved } = await adminFetch<{ product: Product }>(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PATCH" : "POST",
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
    if (!product) return;
    setSaving(true);
    await adminFetch(`/api/admin/products/${product.id}`, { method: "DELETE" }).catch(() => {});
    onDeleted(product.id);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Field label="Imagem" error={errors.image}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-white/5 transition hover:border-brand/60"
        >
          {v.image ? (
            <Image src={v.image} alt="" fill sizes="440px" className="bg-white object-contain p-3" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm text-muted"><ImagePlus className="size-8" /> Enviar imagem</span>
          )}
          {uploading && <span className="absolute inset-0 grid place-items-center bg-black/60"><Loader2 className="size-6 animate-spin" /></span>}
          {v.image && !uploading && <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-xs">Trocar imagem</span>}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </Field>
      <Field label="Nome" error={errors.name}>
        <input className="input" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Elfbar BC PRO 40K" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca" error={errors.brand}>
          <input className="input" value={v.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Elfbar" list="brands" />
        </Field>
        <Field label="Preço (R$)" error={errors.price}>
          <input className="input" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="125,00" />
        </Field>
        <Field label="Puffs" error={errors.puffs}>
          <input className="input" value={v.puffs} onChange={(e) => set("puffs", e.target.value)} placeholder="40.000" />
        </Field>
        <Field label="Capacidade" error={errors.capacity}>
          <input className="input" value={v.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="20 mL" />
        </Field>
      </div>
      <FlavorsField flavors={flavors} onChange={setFlavors} errors={errors} />
      <Field label="Descrição" error={errors.description}>
        <textarea className="input min-h-24" value={v.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      {TAGS.map(({ key, label, hint, icon: Icon }) => (
        <div key={key} className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
          <div>
            <p className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-brand" /> {label}</p>
            <p className="text-xs text-muted">{hint}</p>
          </div>
          <Toggle checked={v[key]} onChange={(x) => set(key, x)} label={label} />
        </div>
      ))}
      <Field label="Selo extra (opcional)" error={errors.badge} hint='Texto livre, ex.: "Promo", "Últimas unidades"'>
        <input className="input" value={v.badge} onChange={(e) => set("badge", e.target.value)} />
      </Field>
      <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
        <div>
          <p className="font-semibold">Visível na loja</p>
          <p className="text-xs text-muted">Desative para esconder sem excluir</p>
        </div>
        <Toggle checked={v.active} onChange={(x) => set("active", x)} label="Visível na loja" />
      </div>
      {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}

      <button disabled={saving || uploading} className="btn-brand">
        {saving && <Loader2 className="size-5 animate-spin" />} {product ? "Salvar alterações" : "Cadastrar produto"}
      </button>

      {product && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Link href={`/produto/${product.slug}`} target="_blank" className="btn-ghost text-sm">
            <ExternalLink className="size-4" /> Ver na loja
          </Link>
          <AnimatePresence mode="wait" initial={false}>
            {confirmDelete ? (
              <motion.div key="confirm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost text-sm">Cancelar</button>
                <button type="button" onClick={remove} className="btn-ghost border-red-500/50! bg-red-500/15! text-sm text-red-300">Excluir de vez</button>
              </motion.div>
            ) : (
              <motion.button key="ask" type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-2 py-2 text-sm text-red-300 hover:text-red-200">
                <Trash2 className="size-4" /> Excluir produto
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
    </form>
  );
}

// Um sabor por linha com a quantidade em estoque; o total do produto é a soma.
function FlavorsField({ flavors, onChange, errors }: { flavors: FlavorRow[]; onChange: (f: FlavorRow[]) => void; errors: Record<string, string> }) {
  const update = (i: number, patch: Partial<FlavorRow>) => onChange(flavors.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const total = flavors.reduce((s, f) => s + (Number(f.stock) || 0), 0);
  const reserved = flavors.reduce((s, f) => s + (f.reserved ?? 0), 0);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-muted">
        <span>Sabores e estoque</span>
        <span>
          Total: <span className="font-semibold text-white">{total}</span>
          {reserved > 0 && <span className="text-brand"> • {reserved} reservado{reserved > 1 ? "s" : ""} em PIX</span>}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {flavors.map((f, i) => (
          <li key={i}>
            <div className="flex items-center gap-2">
              <input className="input min-w-0 flex-1 py-2!" value={f.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Sabor (ex.: Grape Ice)" aria-label={`Sabor ${i + 1}`} />
              <input
                className="input w-24 py-2! text-center"
                inputMode="numeric"
                value={f.stock}
                onChange={(e) => update(i, { stock: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                placeholder="Qtd."
                aria-label={`Quantidade de ${f.name || `sabor ${i + 1}`}`}
              />
              <button
                type="button"
                onClick={() => onChange(flavors.filter((_, j) => j !== i))}
                disabled={flavors.length === 1}
                aria-label="Remover sabor"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-red-400 disabled:opacity-30"
              >
                <X className="size-4" />
              </button>
            </div>
            {!!f.reserved && <p className="mt-1 text-xs text-brand">{f.reserved} reservado{f.reserved > 1 ? "s" : ""} em PIX aguardando pagamento</p>}
            {errors[`flavor${i}`] && <p className="mt-1 text-sm text-red-400">{errors[`flavor${i}`]}</p>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onChange([...flavors, { name: "", stock: "" }])} className="btn-ghost mt-2 w-full py-2! text-sm">
        <Plus className="size-4 text-brand" /> Adicionar sabor
      </button>
      {errors.flavors && <p className="mt-1 text-sm text-red-400">{errors.flavors}</p>}
      <p className="mt-1 text-xs text-muted">O PIX gerado reserva as unidades; elas só saem do estoque quando o pagamento é confirmado.</p>
    </div>
  );
}
