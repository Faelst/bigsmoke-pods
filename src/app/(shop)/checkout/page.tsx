"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bike, Clock, CreditCard, Loader2, Lock, QrCode, ShoppingBag, Smartphone, User, Wallet as WalletIcon } from "lucide-react";
import { cart, useCart } from "@/lib/cart";
import { brl, formatPhone, onlyDigits } from "@/lib/format";
import { formatOpening } from "@/lib/hours";
import { rememberOrder, saveCheckout, savedCheckout, type SavedCheckout } from "@/lib/my-orders";
import { useSession } from "@/lib/session";
import { WALLET_LABEL, type Address, type Contact, type DeliveryQuote, type PaymentMethod, type Wallet } from "@/lib/types";
import { AddressFields, EMPTY_ADDRESS, isAddressComplete } from "@/components/AddressFields";
import { WhatsAppIcon } from "@/components/icons";
import { CardForm, type CardData } from "./CardForm";

const EMPTY_CARD: CardData = { number: "", name: "", expiry: "", cvv: "", installments: 1 };

type QuoteState = { key: string; loading: boolean; quote?: DeliveryQuote; preorder?: { opensAt: string | null }; error?: string };

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
        setState(res.ok ? { key, loading: false, quote: data.quote, preorder: data.preorder } : { key, loading: false, error: data.error ?? Object.values(data.errors ?? {})[0] });
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

const EMPTY_CONTACT: Contact = { name: "", phone: "" };
const isContactComplete = (c: Contact) => c.name.trim().length >= 2 && [10, 11].includes(onlyDigits(c.phone).length);

// Apple Pay no Safari de iPhone/iPad/Mac; Google Pay no resto.
const detectWallet = (): Wallet => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Android/.test(ua) ? "apple_pay" : "google_pay";
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, count } = useCart();
  const { customer } = useSession();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [card, setCard] = useState<CardData>(EMPTY_CARD);
  const [wallet, setWallet] = useState<Wallet>("google_pay");
  const [saved, setSaved] = useState<SavedCheckout | null>(null);
  const [contactDraft, setContact] = useState<Contact | null>(null);
  const [addressDraft, setAddress] = useState<Address | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados do aparelho só existem no navegador: carrega depois de montar.
  useEffect(() => {
    const t = setTimeout(() => {
      setSaved(savedCheckout());
      setWallet(detectWallet());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const contact = contactDraft ?? saved?.contact ?? (customer ? { name: customer.name, phone: customer.phone } : EMPTY_CONTACT);
  const address = addressDraft ?? saved?.address ?? customer?.address ?? EMPTY_ADDRESS;
  const identified = isContactComplete(contact);
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
        contact,
        address,
        method,
        card: method === "card" ? card : undefined,
        wallet: method === "wallet" ? wallet : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitting(false);
      return setError(data.error ?? "Não foi possível finalizar o pedido");
    }
    rememberOrder(data.order.id);
    saveCheckout({ contact, address });
    router.push(`/pedido/${data.order.id}`);
    cart.clear();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6">
      <h1 className="font-display text-3xl">Checkout</h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-5">
          {/* 1. Contato */}
          <Step n={1} title="Seus dados" done={identified}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-sm font-medium text-muted">WhatsApp</span>
                <span className="relative block">
                  <WhatsAppIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#25D366]" />
                  <input
                    className="input pl-12!"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(12) 99999-9999"
                    value={formatPhone(contact.phone)}
                    onChange={(e) => setContact({ ...contact, phone: onlyDigits(e.target.value).slice(0, 11) })}
                  />
                </span>
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium text-muted">Nome</span>
                <span className="relative block">
                  <User className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
                  <input className="input pl-12!" autoComplete="name" placeholder="Como te chamamos?" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
                </span>
              </label>
            </div>
            <p className="mt-3 text-xs text-muted">
              Sem cadastro: você acompanha o pedido pelo WhatsApp em <Link href="/pedidos" className="text-white underline-offset-4 hover:underline">Meus pedidos</Link>.
              {!customer && <> Tem conta? <Link href="/entrar?next=/checkout" className="text-brand">Entrar</Link></>}
            </p>
          </Step>

          {/* 2. Endereço */}
          <Step n={2} title="Endereço de entrega" done={!!quote} disabled={!identified}>
            <p className="-mt-2 mb-3 text-sm text-muted">Digite o CEP: a gente acha a rua, você só completa número e apto.</p>
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
                        {!quote.free && (quote.surge ?? 1) > 1 && (
                          <p className="text-xs text-brand">{delivery.preorder ? "Frete com tarifa dinâmica" : "Horário de pico: frete com tarifa dinâmica"}</p>
                        )}
                      </div>
                      <span className={`font-display text-lg ${quote.free ? "text-leaf" : "text-brand"}`}>{quote.free ? "Grátis" : brl(quote.fee)}</span>
                    </div>
                  )}
                  {quote && delivery.preorder && (
                    <div className="mt-3 flex gap-3 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
                      <Clock className="size-5 shrink-0 text-brand" />
                      <div>
                        <p className="font-semibold">Loja fechada: seu pedido será uma encomenda</p>
                        <p className="mt-0.5 text-muted">
                          Enviamos assim que a loja abrir{delivery.preorder.opensAt && ` (${formatOpening(delivery.preorder.opensAt)})`} — se der, sai antes.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Step>

          {/* 3. Pagamento */}
          <Step n={3} title="Pagamento" disabled={!quote}>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-surface-2 p-1.5">
              {([
                { id: "pix", label: "PIX", icon: QrCode },
                { id: "wallet", label: WALLET_LABEL[wallet], icon: wallet === "apple_pay" ? Smartphone : WalletIcon },
                { id: "card", label: "Cartão", icon: CreditCard },
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
                ) : method === "wallet" ? (
                  <div className="flex gap-4 rounded-2xl border border-line bg-surface-2 p-4 text-sm">
                    {wallet === "apple_pay" ? <Smartphone className="size-10 shrink-0" /> : <WalletIcon className="size-10 shrink-0" />}
                    <div>
                      <p className="font-semibold">Pague com {WALLET_LABEL[wallet]}</p>
                      <p className="mt-1 text-muted">Confirme com {wallet === "apple_pay" ? "Face ID ou Touch ID" : "a digital ou o bloqueio de tela"}, sem digitar o cartão.</p>
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

          <button
            onClick={placeOrder}
            disabled={!identified || !quote || submitting}
            className={method === "wallet" ? "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-lg font-semibold text-black transition active:scale-[.98] disabled:opacity-40" : "btn-brand mt-5 w-full text-lg"}
          >
            {submitting ? <Loader2 className="size-5 animate-spin" /> : method === "wallet" ? null : <Lock className="size-4" />}
            {method === "wallet" ? `${WALLET_LABEL[wallet]} · ${brl(grandTotal)}` : `${delivery?.preorder ? "Encomendar" : method === "pix" ? "Gerar PIX" : "Pagar"} ${brl(grandTotal)}`}
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
