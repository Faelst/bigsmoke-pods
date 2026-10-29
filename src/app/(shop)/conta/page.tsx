"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { AtSign, ChevronRight, LogOut, Mail, MapPin, Package, Phone } from "lucide-react";
import { brl, formatDate, formatPhone } from "@/lib/format";
import { formatAddress } from "@/lib/delivery-pricing";
import { logout, useSession } from "@/lib/session";
import type { Order } from "@/lib/types";
import { StatusBadge } from "@/components/OrderStatus";

export default function AccountPage() {
  const router = useRouter();
  const { customer, loaded } = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (!customer) {
      router.replace("/entrar?next=/conta");
      return;
    }
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []));
  }, [loaded, customer, router]);

  if (!customer) return <Skeleton />;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-brand font-display text-2xl text-black">
            {customer.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted">Olá,</p>
            <h1 className="truncate font-display text-2xl">{customer.name}</h1>
          </div>
        </div>
        <div className="relative mt-5 grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex min-w-0 items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 sm:col-span-2"><Mail className="size-4 shrink-0 text-brand" /> <span className="truncate">{customer.email}</span></p>
          <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5"><Phone className="size-4 text-brand" /> {formatPhone(customer.phone)}</p>
          <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5"><AtSign className="size-4 text-brand" /> {customer.instagram}</p>
          {customer.address && (
            <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 sm:col-span-2"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" /> {formatAddress(customer.address)}</p>
          )}
        </div>
        <button
          onClick={async () => {
            await logout();
            router.replace("/");
          }}
          className="relative mt-4 inline-flex items-center gap-2 text-sm text-muted hover:text-white"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </motion.section>

      <h2 className="mb-3 mt-8 font-display text-xl">Meus pedidos</h2>
      {orders === null ? (
        <div className="flex flex-col gap-3">{[0, 1].map((i) => <div key={i} className="card h-28 animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-10 text-center text-muted">
          <Package className="size-10 text-line" />
          Você ainda não fez nenhum pedido.
          <Link href="/" className="btn-brand mt-2">Ver produtos</Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o, i) => (
            <motion.li key={o.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link href={`/pedido/${o.id}`} className="card flex items-center gap-4 p-4 transition hover:border-brand/50">
                <div className="flex -space-x-4">
                  {o.items.slice(0, 3).map((it) => (
                    <Image key={it.slug + it.flavor} src={it.image} alt="" width={48} height={48} className="size-12 rounded-xl border-2 border-surface bg-white object-contain" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">#{o.code}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(o.createdAt)} • {o.items.reduce((s, it) => s + it.qty, 0)} itens • <span className="text-white">{brl(o.total)}</span>
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted" />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6">
      <div className="card h-44 animate-pulse" />
    </div>
  );
}
