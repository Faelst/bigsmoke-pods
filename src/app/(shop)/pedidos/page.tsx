"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ChevronRight, Clock, Loader2, Package, Search, User } from "lucide-react";
import { brl, formatDate, formatPhone, onlyDigits } from "@/lib/format";
import { deviceOrderIds, savedCheckout } from "@/lib/my-orders";
import { useSession } from "@/lib/session";
import type { OrderSummary } from "@/lib/types";
import { StatusBadge } from "@/components/OrderStatus";
import { WhatsAppIcon } from "@/components/icons";

const isActive = (o: OrderSummary) => !["entregue", "cancelado"].includes(o.status);

export default function MyOrdersPage() {
  const { customer } = useSession();
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(value = phone) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: value, ids: deviceOrderIds() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrders(data.orders);
    } catch (e) {
      setError((e as Error).message || "Não foi possível buscar seus pedidos");
    } finally {
      setLoading(false);
    }
  }

  // Já busca com o WhatsApp do último checkout feito neste aparelho.
  useEffect(() => {
    const t = setTimeout(() => {
      const known = savedCheckout()?.contact.phone;
      if (known) {
        setPhone(known);
        search(known);
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na abertura
  }, []);

  const active = orders?.filter(isActive) ?? [];
  const past = orders?.filter((o) => !isActive(o)) ?? [];
  const valid = [10, 11].includes(onlyDigits(phone).length);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <h1 className="font-display text-3xl">Meus pedidos</h1>
      <p className="mt-1 text-sm text-muted">Acompanhe pelo WhatsApp que você usou na compra.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) search();
        }}
        className="mt-5 flex gap-2"
      >
        <span className="relative block flex-1">
          <WhatsAppIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#25D366]" />
          <input
            className="input pl-12!"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(12) 99999-9999"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))}
          />
        </span>
        <button type="submit" disabled={!valid || loading} className="btn-brand shrink-0 px-5!">
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Search className="size-5" />}
          <span className="hidden sm:inline">Buscar</span>
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {customer && (
        <Link href="/conta" className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-white">
          <User className="size-4" /> Pedidos da sua conta
        </Link>
      )}

      {orders && orders.length === 0 && (
        <div className="card mt-6 flex flex-col items-center gap-3 p-10 text-center text-muted">
          <Package className="size-10 text-line" />
          Nenhum pedido encontrado para este WhatsApp.
          <Link href="/" className="btn-brand mt-2">Ver produtos</Link>
        </div>
      )}
      {active.length > 0 && <OrderList title="Em andamento" orders={active} />}
      {past.length > 0 && <OrderList title="Anteriores" orders={past} />}
      {orders?.some((o) => !o.id) && (
        <p className="mt-4 text-xs text-muted">
          Por segurança, endereço e detalhes completos só abrem no aparelho em que o pedido foi feito (ou pelo link do pedido).
        </p>
      )}
    </div>
  );
}

function OrderList({ title, orders }: { title: string; orders: OrderSummary[] }) {
  return (
    <>
      <h2 className="mb-3 mt-8 font-display text-xl">{title}</h2>
      <ul className="flex flex-col gap-3">
        {orders.map((o, i) => {
          const inner = (
            <>
              <div className="flex -space-x-4">
                {o.items.slice(0, 3).map((it) => (
                  <Image key={it.name + it.flavor} src={it.image} alt="" width={48} height={48} className="size-12 rounded-xl border-2 border-surface bg-white object-contain" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">#{o.code}</span>
                  <StatusBadge status={o.status} />
                  {o.preorder && isActive(o) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand"><Clock className="size-3" /> Encomenda</span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-muted">{o.items.map((it) => `${it.qty}× ${it.name} (${it.flavor})`).join(", ")}</p>
                <p className="text-sm text-muted">
                  {formatDate(o.createdAt)} • <span className="text-white">{brl(o.total)}</span>
                </p>
              </div>
              {o.id && <ChevronRight className="size-5 shrink-0 text-muted" />}
            </>
          );
          return (
            <motion.li key={o.code} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              {o.id ? (
                <Link href={`/pedido/${o.id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand/50">{inner}</Link>
              ) : (
                <div className="card flex items-center gap-4 p-4">{inner}</div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}
