"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bike, Check, ChevronLeft, Copy, CreditCard, ExternalLink, Loader2, QrCode } from "lucide-react";
import { brl, formatDate } from "@/lib/format";
import { formatAddress } from "@/lib/delivery-pricing";
import { whatsappLink } from "@/lib/site";
import type { Order } from "@/lib/types";
import { StatusBadge, StatusTimeline } from "@/components/OrderStatus";
import { OrderTotals } from "@/components/OrderTotals";
import { WhatsAppIcon } from "@/components/icons";

export function OrderView({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    if (res.status === 401) {
      router.replace(`/entrar?next=/pedido/${id}`);
      return;
    }
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setOrder(data.order);
    setPixQr(data.pixQr);
  }, [id, router]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center text-muted">
        {error}
        <Link href="/conta" className="btn-ghost mt-6 flex">Meus pedidos</Link>
      </div>
    );
  }
  if (!order) return <div className="mx-auto mt-6 h-64 max-w-3xl animate-pulse rounded-3xl bg-surface" />;

  const waitingPix = order.payment.method === "pix" && order.status === "aguardando_pagamento";
  const waText = `Olá! Acabei de fazer o pedido #${order.code} no site Big Smoke Pods.\n\n${order.items
    .map((i) => `• ${i.qty}x ${i.name} (${i.flavor})`)
    .join("\n")}\n\nTotal: ${brl(order.total)}${order.address ? `\nEntrega: ${formatAddress(order.address)}` : ""}\nPode me avisar quando sair? 🚀`;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4">
      <Link href="/conta" className="inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ChevronLeft className="size-4" /> Meus pedidos
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Pedido #{order.code}</h1>
          <p className="text-sm text-muted">{formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <AnimatePresence>
        {justPaid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 flex items-center gap-3 rounded-2xl border border-leaf/40 bg-leaf/10 p-4"
          >
            <motion.span
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 10, delay: 0.1 }}
              className="grid size-10 place-items-center rounded-full bg-leaf text-black"
            >
              <Check className="size-6" />
            </motion.span>
            <div>
              <p className="font-semibold">Pagamento confirmado!</p>
              <p className="text-sm text-muted">Já estamos separando seu pedido.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {waitingPix && order.payment.method === "pix" && (
        <PixPanel
          orderId={order.id}
          code={order.payment.pixCode}
          qr={pixQr}
          expiresAt={order.payment.expiresAt}
          total={order.total}
          onPaid={(o) => {
            setOrder(o);
            setJustPaid(true);
          }}
          onExpired={load}
        />
      )}

      {order.status === "saiu_para_entrega" && <OnTheWay trackingUrl={order.trackingUrl} />}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-5 font-semibold">Acompanhe seu pedido</h2>
          <StatusTimeline order={order} />
        </section>

        <section className="card flex flex-col p-5">
          <h2 className="mb-4 font-semibold">Itens</h2>
          <ul className="flex flex-col gap-3">
            {order.items.map((i) => (
              <li key={i.slug + i.flavor} className="flex items-center gap-3 text-sm">
                <Image src={i.image} alt="" width={48} height={48} className="size-12 rounded-xl bg-white object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{i.qty}× {i.name}</p>
                  <p className="text-muted">{i.flavor}</p>
                </div>
                <span>{brl(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <OrderTotals order={order} />
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted">
              {order.payment.method === "pix" ? (
                <><QrCode className="size-4" /> PIX</>
              ) : (
                <><CreditCard className="size-4" /> {order.payment.brand} •••• {order.payment.last4} ({order.payment.installments}x)</>
              )}
            </span>
            <span className="font-display text-xl text-brand">{brl(order.total)}</span>
          </div>
          <a href={whatsappLink(waText)} target="_blank" rel="noreferrer" className="btn-ghost mt-5 border-[#25D366]/40">
            <WhatsAppIcon className="size-5 text-[#25D366]" /> Falar sobre o pedido no WhatsApp
          </a>
        </section>
      </div>
    </div>
  );
}

function OnTheWay({ trackingUrl }: { trackingUrl?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card relative mt-5 overflow-hidden border-brand/40 p-5"
    >
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand text-black">
          <motion.span animate={{ x: [-3, 3, -3], y: [0, -1.5, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}>
            <Bike className="size-7" />
          </motion.span>
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight">Seu pedido está a caminho!</p>
          <p className="text-sm text-muted">
            {trackingUrl ? "Acompanhe o entregador em tempo real pelo app da Uber." : "O entregador já saiu com seu pedido."}
          </p>
        </div>
      </div>
      {trackingUrl && (
        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="btn-brand relative mt-4 w-full">
          Acompanhar no app da Uber <ExternalLink className="size-4" />
        </a>
      )}
    </motion.section>
  );
}

function PixPanel({
  orderId, code, qr, expiresAt, total, onPaid, onExpired,
}: {
  orderId: string; code: string; qr: string | null; expiresAt: string; total: number;
  onPaid: (o: Order) => void; onExpired: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const remaining = useCountdown(expiresAt);

  useEffect(() => {
    if (remaining === 0) onExpired();
  }, [remaining, onExpired]);

  async function simulatePayment() {
    setPaying(true);
    const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
    const data = await res.json();
    setPaying(false);
    if (res.ok) onPaid(data.order);
  }

  const mm = String(Math.floor((remaining ?? 0) / 60)).padStart(2, "0");
  const ss = String((remaining ?? 0) % 60).padStart(2, "0");

  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card mt-5 overflow-hidden">
      <div className="flex items-center justify-between bg-brand px-5 py-3 text-black">
        <span className="font-semibold">Pague com PIX</span>
        <span className="font-mono font-bold">{remaining === null ? "--:--" : `${mm}:${ss}`}</span>
      </div>
      <div className="flex flex-col items-center gap-5 p-5 md:flex-row md:items-start">
        <div className="relative rounded-2xl bg-white p-3">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code PIX" className="size-52" />
          ) : (
            <div className="size-52 animate-pulse rounded-xl bg-zinc-200" />
          )}
          <motion.span
            aria-hidden
            className="absolute inset-x-3 h-0.5 bg-leaf shadow-[0_0_12px_2px] shadow-leaf"
            animate={{ top: ["12px", "calc(100% - 12px)", "12px"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm text-muted">
            Escaneie o QR Code ou copie o código abaixo no app do seu banco. Valor: <span className="font-semibold text-white">{brl(total)}</span>
          </p>
          <div className="truncate rounded-xl bg-surface-2 p-3 font-mono text-xs text-muted">{code}</div>
          <button
            className="btn-brand"
            onClick={async () => {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
            {copied ? "Código copiado!" : "Copiar código PIX"}
          </button>
          <button onClick={simulatePayment} disabled={paying} className="btn-ghost text-sm">
            {paying && <Loader2 className="size-4 animate-spin" />} Simular pagamento (demo)
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function useCountdown(target: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return null;
  return Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
}
