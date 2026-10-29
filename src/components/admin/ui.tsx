"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Painel lateral (desktop) / bottom sheet (mobile)
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[2rem] border-t border-line bg-surface md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[480px] md:rounded-none md:rounded-l-[2rem] md:border-l md:border-t-0"
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h2 className="font-display text-lg">{title}</h2>
              <button onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center rounded-xl bg-surface-2"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-red-400">{error}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-leaf" : "bg-line"}`}
    >
      <motion.span layout transition={{ type: "spring", damping: 25, stiffness: 400 }} className={`absolute top-1 size-5 rounded-full bg-white shadow ${checked ? "right-1" : "left-1"}`} />
    </button>
  );
}
