"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { TIME_RE } from "@/lib/hours";

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

const maskTime = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
};

// Ao sair do campo: "9" → "09:00", "930" → "09:30", "2130" → "21:30".
const completeTime = (draft: string) => {
  const d = draft.replace(/\D/g, "");
  if (d.length === 1 || d.length === 2) return `${d.padStart(2, "0")}:00`;
  if (d.length === 3) return `0${d[0]}:${d.slice(1)}`;
  return maskTime(d);
};

// Horário sempre em 24h (HH:MM, padrão brasileiro). O <input type="time"> segue o idioma
// do sistema/navegador e aparece com AM/PM em aparelhos em inglês.
export function TimeInput({
  value, onChange, className = "", label,
}: { value: string; onChange: (v: string) => void; className?: string; label?: string }) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      placeholder="00:00"
      maxLength={5}
      className={`input font-mono tabular-nums ${className}`}
      value={draft}
      onChange={(e) => {
        const v = maskTime(e.target.value);
        setDraft(v);
        if (TIME_RE.test(v)) onChange(v);
      }}
      onBlur={() => {
        if (TIME_RE.test(draft)) return;
        const fixed = completeTime(draft);
        if (TIME_RE.test(fixed)) {
          setDraft(fixed);
          onChange(fixed);
        } else setDraft(value);
      }}
    />
  );
}
