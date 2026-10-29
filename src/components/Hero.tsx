"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { ArrowDown, Truck, ShieldCheck, Zap } from "lucide-react";
import { Smoke } from "./Smoke";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Smoke />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 pb-6 pt-8 md:grid-cols-[1.2fr_1fr] md:pb-14 md:pt-16">
        <div className="text-center md:text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 14 }}
            className="mb-4 md:hidden"
          >
            <Image src="/brand/logo.png" alt="Big Smoke Pods" width={112} height={112} priority className="mx-auto rounded-[1.75rem] shadow-[0_12px_40px_-10px_rgb(255_178_0/0.6)]" />
          </motion.div>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-leaf/30 bg-leaf/10 px-3 py-1 text-xs font-semibold text-leaf"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-leaf" /> Entrega rápida
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl"
          >
            Os pods mais <span className="text-gradient animate-shine">brabos</span> da quebrada
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-md text-muted md:mx-0"
          >
            Elfbar, Ignite e muito mais. Escolha seu sabor, pague no PIX ou cartão e receba rapidinho.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex justify-center md:justify-start"
          >
            <a href="#busca" className="btn-brand">
              Ver produtos <ArrowDown className="size-4" />
            </a>
          </motion.div>
          <motion.ul
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}
            className="mt-8 grid grid-cols-3 gap-2 text-[11px] text-muted sm:text-xs"
          >
            {[
              { icon: Zap, t: "PIX na hora" },
              { icon: ShieldCheck, t: "100% original" },
              { icon: Truck, t: "Entrega rápida" },
            ].map(({ icon: Icon, t }) => (
              <motion.li
                key={t}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface/70 p-3 md:flex-row"
              >
                <Icon className="size-4 text-brand" /> {t}
              </motion.li>
            ))}
          </motion.ul>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 14, delay: 0.15 }}
          className="relative mx-auto hidden w-full max-w-sm md:block"
        >
          <div className="absolute inset-6 rounded-full bg-brand/40 blur-3xl" />
          <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}>
            <Image src="/brand/logo.png" alt="Big Smoke Pods" width={420} height={420} priority className="relative rounded-[3rem] shadow-2xl" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
