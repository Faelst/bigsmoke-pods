"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, Bike, ChevronRight, Clock, ExternalLink, History, Link2, Loader2, Mail, Navigation, PencilLine, Plus, RefreshCw, Search, Store } from "lucide-react";
import { adminFetch, useAdminData } from "@/lib/admin-client";
import { brl, formatDate, formatPhone, onlyDigits } from "@/lib/format";
import { normalize } from "@/lib/products";
import { STATUS_FLOW, STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";
import { StatusBadge, StatusTimeline } from "@/components/OrderStatus";
import { OrderTotals } from "@/components/OrderTotals";
import { PaymentLabel, paymentShort } from "@/components/PaymentLabel";
import { WhatsAppIcon } from "@/components/icons";
import { PageTitle, Sheet } from "@/components/admin/ui";
import { ManualSaleForm } from "./ManualSale";

type AdminOrder = Order & { customer: { name: string; email: string; phone: string; instagram: string } | null };

const FILTERS: (OrderStatus | "todos")[] = ["todos", ...STATUS_FLOW, "cancelado"];

export function OrdersAdmin() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = (params.get("status") as OrderStatus | null) ?? "todos";
  const selectedId = params.get("id");
  const { data, setData } = useAdminData<{ orders: AdminOrder[] }>("/api/admin/orders");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const orders = useMemo(() => {
    const term = normalize(q);
    const digits = onlyDigits(q);
    return (data?.orders ?? []).filter(
      (o) =>
        (status === "todos" || o.status === status) &&
        (!term ||
          normalize(`${o.code} ${o.customer?.name} ${o.customer?.email} ${o.customer?.instagram}`).includes(term) ||
          (digits.length >= 3 && o.customer?.phone.includes(digits))),
    );
  }, [data, status, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: data?.orders.length ?? 0 };
    for (const o of data?.orders ?? []) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [data]);

  const selected = data?.orders.find((o) => o.id === selectedId) ?? null;

  const onUpdated = (order: AdminOrder) =>
    setData((d) => d && { orders: d.orders.map((o) => (o.id === order.id ? order : o)) });

  return (
    <>
      <PageTitle
        title="Pedidos"
        subtitle="Acompanhe e atualize o status dos pedidos"
        action={
          <button onClick={() => setAdding(true)} className="btn-brand py-2.5!">
            <Plus className="size-4" /> Venda manual
          </button>
        }
      />

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input className="input pl-12!" placeholder="Buscar por código, cliente, e-mail ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
        {FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setParam("status", s === "todos" ? null : s)}
            className={`relative shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${status === s ? "text-black" : "bg-surface-2 text-muted hover:text-white"}`}
          >
            {status === s && <motion.span layoutId="order-filter" className="absolute inset-0 rounded-full bg-brand" />}
            <span className="relative">{s === "todos" ? "Todos" : STATUS_LABEL[s]} <span className="opacity-60">{counts[s] ?? 0}</span></span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {!data ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="card h-20 animate-pulse" />)}</div>
        ) : orders.length === 0 ? (
          <p className="card p-10 text-center text-muted">Nenhum pedido encontrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {orders.map((o) => (
                <motion.li key={o.id} layout className="min-w-0" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <button onClick={() => setParam("id", o.id)} className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-brand/50 sm:p-4">
                    <Image src={o.items[0].image} alt="" width={48} height={48} className="size-12 shrink-0 rounded-xl bg-white object-contain" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">#{o.code}</span>
                        <StatusBadge status={o.status} />
                        {o.payment.method === "manual" && <ManualBadge />}
                        {o.preorder && <PreorderBadge />}
                        {o.fulfillment === "pickup" && <PickupBadge />}
                      </div>
                      <p className="mt-1 truncate text-sm text-muted">
                        {o.customer?.name ?? "—"} • {formatDate(o.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{brl(o.total)}</p>
                      <p className="text-xs text-muted">{paymentShort(o.payment)}</p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Sheet open={!!selected} onClose={() => setParam("id", null)} title={selected ? `Pedido #${selected.code}` : ""}>
        {selected && <OrderDetail key={selected.id} order={selected} onUpdated={onUpdated} />}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Venda manual">
        <ManualSaleForm<AdminOrder>
          onCreated={(order) => {
            setData((d) => d && { orders: [order, ...d.orders] });
            setAdding(false);
          }}
        />
      </Sheet>
    </>
  );
}

function OrderDetail({ order, onUpdated }: { order: AdminOrder; onUpdated: (o: AdminOrder) => void }) {
  const [saving, setSaving] = useState<OrderStatus | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [link, setLink] = useState("");
  const c = order.customer;
  const manual = order.payment.method === "manual";
  // Com o /ras o link chega ainda em separação (o motoboy está indo retirar).
  const onTheWay = order.status === "saiu_para_entrega" || order.status === "entregue" || (order.status === "em_separacao" && !!order.trackingUrl);
  const previous = order.previousTracking ?? [];

  async function update(body: { status?: OrderStatus; trackingUrl?: string }, key: OrderStatus | "link") {
    setSaving(key);
    setError(null);
    try {
      const { order: updated } = await adminFetch<{ order: AdminOrder }>(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onUpdated(updated);
      setDispatching(false);
      setLink("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  // "Saiu para entrega" pede o link da corrida antes de confirmar (se o /ras ainda não trouxe).
  const changeStatus = (s: OrderStatus) => (s === "saiu_para_entrega" && !order.trackingUrl ? setDispatching(true) : update({ status: s }, s));

  const linkInput = (placeholder = "Cole o link de compartilhar viagem da Uber") => (
    <label className="relative block">
      <Link2 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
      <input
        className="input pl-12! text-sm"
        type="url"
        inputMode="url"
        placeholder={placeholder}
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
    </label>
  );

  const waTracking =
    c?.phone && order.trackingUrl
      ? `https://api.whatsapp.com/send?phone=55${c.phone}&text=${encodeURIComponent(
          previous.length
            ? `Olá ${c.name.split(" ")[0]}! A corrida anterior do seu pedido #${order.code} foi cancelada pelo app de entregas e já chamamos outro motoboy 🛵\nSegue o novo link para acompanhar o rastreio do motoboy: ${order.trackingUrl}`
            : order.status === "em_separacao"
              ? `Olá ${c.name.split(" ")[0]}! Pedido #${order.code} da Big Smoke Pods: o motoboy já aceitou a corrida e está vindo retirar. Segue o link: ${order.trackingUrl}`
              : `Olá ${c.name.split(" ")[0]}! Pedido #${order.code} da Big Smoke Pods: o motoboy acabou de retirar sua entrega e já está a caminho 🎉\nAcompanhe em tempo real: ${order.trackingUrl}`,
        )}`
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <StatusBadge status={order.status} />
        <span className="text-sm text-muted">{formatDate(order.createdAt)}</span>
      </div>

      {manual && (
        <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 p-3 text-sm">
          <PencilLine className="size-4 shrink-0 text-brand" />
          Venda manual, feita por fora da loja. Lançou por engano? Cancele e os itens voltam ao estoque.
        </p>
      )}

      {order.fulfillment === "pickup" && (
        <p className="flex items-center gap-2 rounded-2xl border border-leaf/40 bg-leaf/5 p-3 text-sm">
          <Store className="size-4 shrink-0 text-leaf" />
          Retirada no local: o cliente foi orientado a chamar a loja no WhatsApp para combinar.
        </p>
      )}

      {order.preorder && (
        <p className="flex items-center gap-2 rounded-2xl border border-brand/40 bg-brand/5 p-3 text-sm">
          <Clock className="size-4 shrink-0 text-brand" />
          Encomenda feita com a loja fechada{order.preorder.opensAt && ` — enviar a partir de ${formatDate(order.preorder.opensAt)}`}.
        </p>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Alterar status</h3>
        <div className="grid grid-cols-2 gap-2">
          {[...STATUS_FLOW, "cancelado" as const].map((s) => (
            <button
              key={s}
              disabled={!!saving || order.status === s}
              onClick={() => changeStatus(s)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition disabled:cursor-default ${
                order.status === s
                  ? "border-brand bg-brand text-black"
                  : s === "cancelado"
                    ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
                    : dispatching && s === "saiu_para_entrega"
                      ? "border-brand text-brand"
                      : "border-line bg-surface-2 hover:border-brand/50"
              }`}
            >
              {saving === s && <Loader2 className="size-3.5 animate-spin" />}
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {dispatching && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold"><Bike className="size-4 text-brand" /> Link de acompanhamento da Uber</p>
                <p className="text-xs text-muted">No app da Uber, abra a entrega e toque em compartilhar. O cliente verá o botão para acompanhar.</p>
                {linkInput()}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setDispatching(false)} className="btn-ghost py-2.5! text-xs">Cancelar</button>
                  <button
                    onClick={() => update({ status: "saiu_para_entrega", trackingUrl: link }, "saiu_para_entrega")}
                    disabled={!!saving}
                    className="btn-brand py-2.5! text-xs"
                  >
                    {saving === "saiu_para_entrega" && <Loader2 className="size-3.5 animate-spin" />}
                    {link.trim() ? "Confirmar saída" : "Confirmar sem link"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>

      {onTheWay && !dispatching && (
        <section className="rounded-2xl bg-surface-2 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bike className="size-4 text-brand" /> Acompanhamento da entrega</h3>

          {order.trackingUrl ? (
            <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs hover:border-brand/50">
              <Link2 className="size-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate">{order.trackingUrl}</span>
              <span className="shrink-0 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">Atual</span>
              <ExternalLink className="size-3.5 shrink-0 text-muted" />
            </a>
          ) : (
            <p className="mb-3 text-xs text-muted">Nenhum link salvo ainda.</p>
          )}

          {previous.length > 0 && (
            <details className="mb-3 text-xs text-muted">
              <summary className="flex cursor-pointer items-center gap-1.5 hover:text-white">
                <History className="size-3.5" /> {previous.length} link{previous.length > 1 ? "s" : ""} anterior{previous.length > 1 ? "es" : ""} (corrida cancelada)
              </summary>
              <ul className="mt-2 flex flex-col gap-1.5">
                {[...previous].reverse().map((p, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="min-w-0 flex-1 truncate line-through">{p.url}</span>
                    <span className="shrink-0">trocado {formatDate(p.replacedAt)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {order.trackingUrl && (
            <p className="mb-2 text-xs text-muted">A Uber cancelou a corrida? Cole o link da nova corrida: ele substitui o atual e o cliente recebe o novo link no WhatsApp.</p>
          )}
          {linkInput(order.trackingUrl ? "Link da nova corrida" : undefined)}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => update({ trackingUrl: link }, "link")}
              disabled={!!saving || !link.trim() || link.trim() === (order.trackingUrl ?? "")}
              className="btn-ghost py-2.5! text-xs"
            >
              {saving === "link" ? <Loader2 className="size-3.5 animate-spin" /> : order.trackingUrl && <RefreshCw className="size-3.5" />}
              {order.trackingUrl ? "Trocar link" : "Salvar link"}
            </button>
            {waTracking ? (
              <a href={waTracking} target="_blank" rel="noreferrer" className="btn-ghost py-2.5! text-xs">
                <WhatsAppIcon className="size-4 text-[#25D366]" /> Enviar ao cliente
              </a>
            ) : (
              <span className="grid place-items-center text-center text-xs text-muted">Sem link salvo</span>
            )}
          </div>
        </section>
      )}

      {c && (
        <section className="rounded-2xl bg-surface-2 p-4 text-sm">
          <h3 className="mb-2 font-semibold">{c.name}</h3>
          {c.email ? (
            <p className="flex items-center gap-2 text-muted"><Mail className="size-4" /> {c.email}</p>
          ) : (
            <p className="text-muted">{manual ? "Comprou por fora da loja" : "Comprou sem conta"}</p>
          )}
          {c.instagram && <p className="mt-1 flex items-center gap-2 text-muted"><AtSign className="size-4" /> {c.instagram}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {c.phone && (
              <a
                href={`https://api.whatsapp.com/send?phone=55${c.phone}&text=${encodeURIComponent(`Olá ${c.name.split(" ")[0]}! Sobre seu pedido #${order.code} na Big Smoke Pods:`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost py-2.5! text-xs"
              >
                <WhatsAppIcon className="size-4 text-[#25D366]" /> {formatPhone(c.phone)}
              </a>
            )}
            {c.instagram && (
              <a href={`https://www.instagram.com/${c.instagram}`} target="_blank" rel="noreferrer" className="btn-ghost py-2.5! text-xs">
                <AtSign className="size-4 text-[#e1306c]" /> Instagram
              </a>
            )}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">Itens</h3>
        <ul className="flex flex-col gap-2">
          {order.items.map((i) => (
            <li key={i.slug + i.flavor} className="flex items-center gap-3 text-sm">
              <Image src={i.image} alt="" width={44} height={44} className="size-11 rounded-lg bg-white object-contain" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{i.qty}× {i.name}</p>
                <p className="text-muted">{i.flavor}</p>
              </div>
              <span>{brl(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <OrderTotals order={order} />
        {order.address && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${order.address.lat},${order.address.lng}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost mt-2 py-2.5! text-xs"
          >
            <Navigation className="size-4 text-brand" /> Abrir rota no mapa
          </a>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-muted">
            <PaymentLabel payment={order.payment} />
          </span>
          <span className="font-display text-xl text-brand">{brl(order.total)}</span>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted">Linha do tempo</h3>
        <StatusTimeline order={order} />
      </section>
    </div>
  );
}

function PreorderBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
      <Clock className="size-3" /> Encomenda
    </span>
  );
}

function ManualBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold">
      <PencilLine className="size-3" /> Manual
    </span>
  );
}

function PickupBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-leaf/15 px-2 py-0.5 text-xs font-semibold text-leaf">
      <Store className="size-3" /> Retirada
    </span>
  );
}
