"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { AlertCircle, ChevronRight, DollarSign, Package, Receipt, ShoppingCart, Truck, Users } from "lucide-react";
import { useAdminData } from "@/lib/admin-client";
import { brl, formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";
import { StatusBadge } from "@/components/OrderStatus";
import { PageTitle } from "@/components/admin/ui";

type Stats = {
  revenue: number; paidOrders: number; ticket: number; ordersToday: number; revenueToday: number;
  awaitingPayment: number; toShip: number; customers: number; activeProducts: number;
  daily: { day: string; total: number }[];
  topProducts: { name: string; qty: number; total: number }[];
  recent: (Order & { customer: { name: string } | null })[];
};

export default function DashboardPage() {
  const { data } = useAdminData<Stats>("/api/admin/stats");

  if (!data)
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="card h-28 animate-pulse" />)}
      </div>
    );

  const tiles = [
    { label: "Faturamento total", value: brl(data.revenue), sub: `${data.paidOrders} ${data.paidOrders === 1 ? "pedido pago" : "pedidos pagos"}`, icon: DollarSign, href: "/admin/pedidos" },
    { label: "Hoje", value: brl(data.revenueToday), sub: `${data.ordersToday} ${data.ordersToday === 1 ? "pedido" : "pedidos"} hoje`, icon: Receipt, href: "/admin/pedidos" },
    { label: "Para enviar", value: data.toShip, sub: "pagos ou em separação", icon: Truck, href: "/admin/pedidos?status=pago", alert: data.toShip > 0 },
    { label: "Aguardando PIX", value: data.awaitingPayment, sub: "pagamento pendente", icon: AlertCircle, href: "/admin/pedidos?status=aguardando_pagamento" },
    { label: "Ticket médio", value: brl(data.ticket), sub: "por pedido pago", icon: ShoppingCart },
    { label: "Clientes", value: data.customers, sub: "cadastrados", icon: Users, href: "/admin/clientes" },
    { label: "Produtos ativos", value: data.activeProducts, sub: "visíveis na loja", icon: Package, href: "/admin/produtos" },
  ];

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Visão geral da loja" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => {
          const body = (
            <>
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-medium sm:text-sm">{t.label}</span>
                <t.icon className={`size-4 ${t.alert ? "text-brand" : ""}`} />
              </div>
              <p className="mt-2 truncate font-display text-xl sm:text-2xl">{t.value}</p>
              <p className="mt-0.5 text-xs text-muted">{t.sub}</p>
            </>
          );
          return (
            <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              {t.href ? (
                <Link href={t.href} className={`card block p-4 transition hover:border-brand/50 ${t.alert ? "border-brand/40" : ""}`}>{body}</Link>
              ) : (
                <div className="card p-4">{body}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5">
          <h2 className="font-semibold">Faturamento — últimos 7 dias</h2>
          <p className="text-xs text-muted">Pedidos pagos, por dia</p>
          <RevenueChart daily={data.daily} />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Mais vendidos</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma venda ainda.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 text-sm">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs font-bold text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-muted">{p.qty} un.</span>
                  <span className="w-24 text-right font-semibold">{brl(p.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="card mt-5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Pedidos recentes</h2>
          <Link href="/admin/pedidos" className="text-sm font-semibold text-brand">Ver todos</Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pedidos?id=${o.id}`} className="flex items-center gap-3 py-3 text-sm">
                  <Image src={o.items[0].image} alt="" width={40} height={40} className="size-10 rounded-lg bg-white object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">#{o.code} <span className="font-normal text-muted">• {o.customer?.name ?? "—"}</span></p>
                    <p className="text-xs text-muted">{formatDate(o.createdAt)}</p>
                  </div>
                  <span className="hidden sm:block"><StatusBadge status={o.status} /></span>
                  <span className="font-semibold">{brl(o.total)}</span>
                  <ChevronRight className="size-4 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function RevenueChart({ daily }: { daily: { day: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...daily.map((d) => d.total), 1);
  const peak = daily.reduce((best, d, i) => (d.total > daily[best].total ? i : best), 0);
  const label = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

  return (
    <div className="mt-4">
      <div className="relative flex h-44 items-end gap-2 border-b border-line" role="img" aria-label="Faturamento por dia nos últimos 7 dias">
        {daily.map((d, i) => {
          const h = (d.total / max) * 100;
          return (
            <div
              key={d.day}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
            >
              {(hover === i || (hover === null && i === peak && d.total > 0)) && (
                <span className="absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs font-semibold shadow-lg" style={{ bottom: `calc(${h}% + 6px)` }}>
                  {brl(d.total)}
                </span>
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(h, d.total ? 2 : 0)}%` }}
                transition={{ delay: 0.1 + i * 0.05, type: "spring", damping: 20 }}
                className={`w-full max-w-10 rounded-t-[4px] transition-opacity ${hover !== null && hover !== i ? "opacity-50" : ""} bg-brand`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {daily.map((d) => (
          <span key={d.day} className="flex-1 text-center text-[11px] capitalize text-muted">{label(d.day)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Faturamento por dia</caption>
        <tbody>{daily.map((d) => <tr key={d.day}><th>{formatDate(d.day)}</th><td>{brl(d.total)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
