"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { cart, useCart, useCartUI } from "@/lib/cart";
import { brl } from "@/lib/format";

export function CartDrawer() {
  const { open, toast } = useCartUI();
  const { items, total, count } = useCart();

  return (
    <>
      <AnimatePresence>
        {toast && !open && (
          <motion.button
            onClick={cart.open}
            initial={{ y: 40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.9 }}
            className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-leaf/40 bg-surface-2/95 p-3 text-left shadow-2xl backdrop-blur md:bottom-8"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-leaf text-black">
              <ShoppingBag className="size-4" />
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-semibold">Adicionado ao carrinho</span>
              <span className="block truncate text-muted">{toast}</span>
            </span>
            <span className="ml-auto text-sm font-semibold text-brand">Ver</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cart.close}
            />
            <motion.aside
              role="dialog"
              aria-label="Carrinho"
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[2rem] border-t border-line bg-surface md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-[2rem] md:border-l md:border-t-0"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => info.offset.y > 120 && cart.close()}
            >
              <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-line md:hidden" />
              <div className="flex items-center justify-between px-5 pb-3 pt-4">
                <h2 className="font-display text-xl">Carrinho <span className="text-brand">({count})</span></h2>
                <button onClick={cart.close} aria-label="Fechar" className="grid size-10 place-items-center rounded-xl bg-surface-2">
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-14 text-center text-muted">
                    <ShoppingBag className="size-12 text-line" />
                    <p>Seu carrinho está vazio.</p>
                    <button onClick={cart.close} className="btn-ghost mt-2">Ver produtos</button>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3 pb-4">
                    <AnimatePresence initial={false}>
                      {items.map((i) => (
                        <motion.li
                          key={i.slug + i.flavor}
                          layout
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -60, height: 0, marginBottom: -12 }}
                          className="flex gap-3 rounded-2xl bg-surface-2 p-3"
                        >
                          <Image src={i.image} alt={i.name} width={72} height={72} className="size-18 rounded-xl bg-white object-contain" />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <p className="truncate font-semibold">{i.name}</p>
                            <p className="text-sm text-muted">{i.flavor}</p>
                            <div className="mt-auto flex items-center justify-between pt-2">
                              <span className="font-semibold text-brand">{brl(i.price * i.qty)}</span>
                              <div className="flex items-center gap-1 rounded-xl bg-bg p-1">
                                <button
                                  onClick={() => cart.setQty(i.slug, i.flavor, i.qty - 1)}
                                  aria-label="Diminuir"
                                  className="grid size-7 place-items-center rounded-lg hover:bg-surface"
                                >
                                  {i.qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}
                                </button>
                                <span className="w-6 text-center text-sm font-semibold">{i.qty}</span>
                                <button
                                  onClick={() => cart.setQty(i.slug, i.flavor, i.qty + 1)}
                                  aria-label="Aumentar"
                                  className="grid size-7 place-items-center rounded-lg hover:bg-surface"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>

              {items.length > 0 && (
                <div className="border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  <div className="mb-4 flex items-end justify-between">
                    <span className="text-muted">Total</span>
                    <span className="font-display text-2xl text-brand">{brl(total)}</span>
                  </div>
                  <Link href="/checkout" onClick={cart.close} className="btn-brand w-full text-lg">
                    Finalizar pedido
                  </Link>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
