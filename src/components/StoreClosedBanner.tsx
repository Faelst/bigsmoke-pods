"use client";

import { AnimatePresence, motion } from "motion/react";
import { Moon } from "lucide-react";
import { formatOpening } from "@/lib/hours";
import { useStoreInfo } from "@/lib/store-info";

export function StoreClosedBanner() {
  const { status } = useStoreInfo();
  return (
    <AnimatePresence>
      {status && !status.open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-brand/30 bg-brand/10">
          <p className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-2.5 text-sm">
            <Moon className="size-4 shrink-0 text-brand" />
            <span>
              <strong className="font-semibold">Loja fechada agora{status.opensAt && ` — abrimos ${formatOpening(status.opensAt)}`}.</strong>{" "}
              <span className="text-muted">Você já pode encomendar: enviamos assim que a loja abrir.</span>
            </span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
