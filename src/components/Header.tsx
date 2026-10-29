"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useAnimationControls } from "motion/react";
import { useEffect } from "react";
import { ShoppingBag, User } from "lucide-react";
import { cart, useCart, useCartUI } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { SITE } from "@/lib/site";
import { InstagramIcon } from "./icons";

export function Header() {
  const { count } = useCart();
  const { bump } = useCartUI();
  const { customer } = useSession();
  const controls = useAnimationControls();

  useEffect(() => {
    if (bump) controls.start({ scale: [1, 1.35, 0.9, 1], transition: { duration: 0.45 } });
  }, [bump, controls]);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Início">
          <Image src="/brand/logo.png" alt={SITE.name} width={40} height={40} className="rounded-xl" priority />
          <span className="font-display text-lg leading-none tracking-wide">
            BIG <span className="text-leaf">SMOKE</span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-6 text-sm text-muted md:flex">
          <Link href="/" className="transition hover:text-white">Produtos</Link>
          <Link href="/conta" className="transition hover:text-white">Meus pedidos</Link>
          <a href={SITE.instagramUrl} target="_blank" rel="noreferrer" className="transition hover:text-white">Instagram</a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={SITE.instagramUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-white"
          >
            <InstagramIcon className="size-5" />
          </a>
          <Link
            href={customer ? "/conta" : "/entrar"}
            className="hidden h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted transition hover:bg-surface-2 hover:text-white md:flex"
          >
            <User className="size-5" />
            {customer ? customer.name.split(" ")[0] : "Entrar"}
          </Link>
          <button
            onClick={cart.open}
            aria-label="Abrir carrinho"
            className="relative grid size-10 place-items-center rounded-xl bg-brand text-black transition active:scale-95"
          >
            <ShoppingBag className="size-5" />
            {count > 0 && (
              <motion.span
                animate={controls}
                className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-leaf px-1 text-[11px] font-bold text-black ring-2 ring-bg"
              >
                {count}
              </motion.span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
