"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bike, CreditCard, Loader2, Lock, QrCode, ShoppingBag } from "lucide-react";
import { cart, useCart } from "@/lib/cart";
import { brl, formatPhone } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Address, DeliveryQuote, PaymentMethod } from "@/lib/types";
import { AuthForm } from "@/components/AuthForm";
import { AddressFields, EMPTY_ADDRESS, isAddressComplete } from "@/components/AddressFields";
import { CardForm, type CardData } from "./CardForm";

const EMPTY_CARD: CardData = { number: "", name: "", expiry: "", cvv: "", installments: 1 };

type QuoteState = { key: string; loading: boolean; quote?: DeliveryQuote; error?: string };

// Cota o frete (com debounce) sempre que o endereço completo muda.
function useDeliveryQuote(address: Address, subtotal: number, enabled: boolean) {
  const key = enabled && isAddressComplete(address) ? JSON.stringify([address, subtotal]) : "";
  const [state, setState] = useState<QuoteState | null>(null);
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setState({ key, loading: true });
      try {
        const res = await fetch("/api/delivery/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, subtotal }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        setState(res.ok ? { key, loading: false, quote: data.quote } : { key, loading: false, error: data.error ?? Object.values(data.errors ?? {})[0] });
      } catch {
        if (!ctrl.signal.aborted) setState({ key, loading: false, error: "Não foi possível calcular a entrega. Tente novamente." });
      }
    }, 500);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key resume address+subtotal
  }, [key]);
  if (!key) return null;
  return state?.key === key ? state : { key, loading: true };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, count } = useCart();
  const { customer, loaded } = useSession();
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [card, setCard] = useState<CardData>(EMPTY_CARD);
  const [addressDraft, setAddress] = useState<Address | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identified = !!customer && !editing;
  const address = addressDraft ?? customer?.address ?? EMPTY_ADDRESS;
  const delivery = useDeliveryQuote(address, total, identified);
  const quote = delivery?.quote;
  const grandTotal = total + (quote?.fee ?? 0);

  if (items.length === 0 && !submitting) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center text-muted">
        <ShoppingBag className="size-14 text-line" />
        Seu carrinho está vazio.
        <Link href="/" className="btn-brand">Ver produtos</Link>
      </div>
    );
  }


  async function placeOrder() {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map(({ slug, flavor, qty }) => ({ slug, flavor, qty })),
        address,
        method,
        card: method === "card" ? card : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitting(false);
      return setError(data.error ?? "Não foi possível finalizar o pedido");
    }
    router.push(`/pedido/${data.order.id}`);
    cart.clear();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6">
      <h1 className="font-display text-3xl">Checkout</h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* 1. Identificação */}
          <Step n={1} title="Seus dados" done={identified}>
            {!loaded ? (
              <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />
            ) : identified ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{customer.name}</p>
                  <p className="truncate text-muted">{customer.email}</p>
                  <p className="text-muted">{formatPhone(customer.phone)} • @{customer.instagram}</p>
                </div>
                <button onClick={() => setEditing(true)} className="shrink-0 text-sm font-semibold text-brand">Trocar conta</button>
              </div>
            ) : (
              <AuthForm initialMode={customer ? "login" : "register"} onSuccess={() => setEditing(false)} />
            )}
          </Step>

          {/* 2. Endereço */}
          <Step n={2} title="Endereço de entrega" done={!!quote} disabled={!identified}>
            <AddressFields value={address} onChange={setAddress} />
            <AnimatePresence mode="wait" initial={false}>
              {delivery && (
                <motion.div
                  key={delivery.loading ? "loading" : delivery.error ? "error" : "ok"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4"
                >
                  {delivery.loading ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm text-muted">
                      <Loader2 className="size-5 animate-spin text-brand" /> Calculando entrega…
                    </div>
                  ) : delivery.error ? (
                    <p className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{delivery.error}</p>
                  ) : quote && (
                    <div className="flex items-center gap-4 rounded-2xl border border-brand/40 bg-brand/5 p-4">
                      <motion.span
                        initial={{ x: -24, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ type: "spring", damping: 14 }}
                        className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-black"
                      >
                        <Bike className="size-6" />
                      </motion.span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-semibold">Entrega via motoboy</p>
                        <p className="text-muted">
                          {quote.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km • ~{quote.durationMin} min de trajeto
                        </p>
                      </div>
                      <span className={`font-display text-lg ${quote.free ? "text-leaf" : "text-brand"}`}>{quote.free ? "Grátis" : brl(quote.fee)}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Step>

          {/* 3. Pagamento */}
          <Step n={3} title="Pagamento" disabled={!quote}>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1.5">
              {([
                { id: "pix", label: "PIX", icon: QrCode },
                { id: "card", label: "Cartão de crédito", icon: CreditCard },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setMethod(id)}
                  className={`relative flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${method === id ? "text-black" : "text-muted"}`}
                >
                  {method === id && <motion.span layoutId="pay-tab" className="absolute inset-0 rounded-xl bg-brand" />}
                  <Icon className="relative size-4" />
                  <span className="relative">{label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={method}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-5"
              >
                {method === "pix" ? (
                  <div className="flex gap-4 rounded-2xl border border-leaf/30 bg-leaf/5 p-4 text-sm">
                    <QrCode className="size-10 shrink-0 text-leaf" />
                    <div>
                      <p className="font-semibold">Pagamento instantâneo</p>
                      <p className="mt-1 text-muted">
                        Ao finalizar, geramos um QR Code e o código copia e cola. O pagamento é confirmado na hora e o PIX expira em 15 minutos.
                      </p>
                    </div>
                  </div>
                ) : (
                  <CardForm value={card} onChange={setCard} total={grandTotal} />
                )}
              </motion.div>
            </AnimatePresence>
          </Step>
        </div>

        {/* Resumo */}
        <aside className="card p-5 lg:sticky lg:top-20">
          <h2 className="font-semibold">Resumo ({count} {count === 1 ? "item" : "itens"})</h2>
          <ul className="mt-4 flex max-h-72 flex-col gap-3 overflow-y-auto">
            {items.map((i) => (
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
          <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>{brl(total)}</span></div>
            <div className="flex justify-between text-muted">
              <span>Entrega</span>
              <span>{quote ? (quote.free ? <span className="font-semibold text-leaf">Grátis</span> : brl(quote.fee)) : delivery?.loading ? "Calculando…" : "Informe o endereço"}</span>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-display text-2xl text-brand">{brl(grandTotal)}</span>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto", x: [0, -8, 8, -4, 4, 0] }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button onClick={placeOrder} disabled={!identified || !quote || submitting} className="btn-brand mt-5 w-full text-lg">
            {submitting ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
            {method === "pix" ? "Gerar PIX" : "Pagar"} {brl(grandTotal)}
          </button>
          <p className="mt-3 text-center text-xs text-muted">Ambiente de demonstração — nenhum valor real é cobrado.</p>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, title, done, disabled, children }: { n: number; title: string; done?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card p-5 transition ${disabled ? "pointer-events-none opacity-40" : ""}`}>
      <h2 className="mb-4 flex items-center gap-3 font-semibold">
        <span className={`grid size-7 place-items-center rounded-full text-sm font-bold ${done ? "bg-leaf text-black" : "bg-brand text-black"}`}>
          {done ? "✓" : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
