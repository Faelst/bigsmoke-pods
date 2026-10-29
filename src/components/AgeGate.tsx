"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore, useState } from "react";

const KEY = "bsp_age_ok";
const readOk = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export function AgeGate() {
  const stored = useSyncExternalStore(() => () => {}, readOk, () => true);
  const [accepted, setAccepted] = useState(false);
  const [denied, setDenied] = useState(false);
  const show = !stored && !accepted;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 18 }}
            className="card w-full max-w-sm p-7 text-center"
          >
            <Image src="/brand/logo.png" alt="" width={120} height={120} className="mx-auto -mt-20 rounded-3xl shadow-2xl" />
            <h2 className="mt-4 font-display text-2xl">Você tem 18 anos ou mais?</h2>
            <p className="mt-2 text-sm text-muted">
              {denied ? "Desculpe, o acesso é permitido apenas para maiores de idade." : "Este site vende produtos destinados a maiores de idade."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setDenied(true)} className="btn-ghost">Não</button>
              <button
                className="btn-brand"
                onClick={() => {
                  try { localStorage.setItem(KEY, "1"); } catch {}
                  setAccepted(true);
                }}
              >
                Sim, tenho
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
