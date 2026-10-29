"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, MapPin } from "lucide-react";
import { formatCep } from "@/lib/delivery-pricing";
import { onlyDigits } from "@/lib/format";
import type { Address } from "@/lib/types";

export const EMPTY_ADDRESS: Address = { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };

export const isAddressComplete = (a: Address) =>
  onlyDigits(a.cep).length === 8 && !!a.street.trim() && !!a.number.trim() && !!a.district.trim() && !!a.city.trim() && a.state.length === 2;

// CEP → busca automática da rua/bairro/cidade; cliente completa número e complemento.
export function AddressFields({ value, onChange, errors = {} }: { value: Address; onChange: (a: Address) => void; errors?: Record<string, string> }) {
  const [loading, setLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const filled = !!value.street || !!cepError;
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });

  async function changeCep(raw: string) {
    const cep = onlyDigits(raw).slice(0, 8);
    set({ cep });
    setCepError(null);
    if (cep.length !== 8) return;
    setLoading(true);
    const res = await fetch(`/api/cep/${cep}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setLoading(false);
    if (!res?.ok) return setCepError(data?.error ?? "Não foi possível buscar o CEP. Preencha manualmente.");
    // Rua diferente → número/complemento antigos não valem mais.
    const sameStreet = data.address.street === value.street;
    onChange({ ...value, ...data.address, number: sameStreet ? value.number : "", complement: sameStreet ? value.complement : "" });
    setTimeout(() => numberRef.current?.focus(), 50);
  }

  return (
    <div className="grid grid-cols-6 gap-3">
      <label className="col-span-6 sm:col-span-3">
        <span className="mb-1.5 block text-sm font-medium text-muted">CEP</span>
        <span className="relative block">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <input
            className="input pl-12!"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={formatCep(value.cep)}
            onChange={(e) => changeCep(e.target.value)}
          />
          {loading && <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-brand" />}
        </span>
        {(cepError || errors.cep) && <span className="mt-1 block text-sm text-red-400">{cepError ?? errors.cep}</span>}
      </label>
      <a
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noreferrer"
        className="col-span-6 self-end pb-3 text-sm text-muted underline-offset-4 hover:text-white hover:underline sm:col-span-3"
      >
        Não sei meu CEP
      </a>

      <AnimatePresence initial={false}>
        {filled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="col-span-6 grid grid-cols-6 gap-3 overflow-hidden p-px"
          >
            <Input className="col-span-6" label="Rua" autoComplete="address-line1" value={value.street} onChange={(v) => set({ street: v })} error={errors.street} />
            <Input className="col-span-2" label="Número" inputRef={numberRef} value={value.number} onChange={(v) => set({ number: v })} error={errors.number} />
            <Input className="col-span-4" label="Complemento" placeholder="Apto, bloco… (opcional)" autoComplete="address-line2" value={value.complement} onChange={(v) => set({ complement: v })} />
            <Input className="col-span-6 sm:col-span-3" label="Bairro" value={value.district} onChange={(v) => set({ district: v })} error={errors.district} />
            <Input className="col-span-4 sm:col-span-2" label="Cidade" autoComplete="address-level2" value={value.city} onChange={(v) => set({ city: v })} error={errors.city} />
            <Input className="col-span-2 sm:col-span-1" label="UF" autoComplete="address-level1" value={value.state} onChange={(v) => set({ state: v.toUpperCase().slice(0, 2) })} error={errors.state} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({
  label, value, onChange, error, className, inputRef, ...rest
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; className?: string;
  inputRef?: React.Ref<HTMLInputElement>; placeholder?: string; autoComplete?: string;
}) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input ref={inputRef} className="input" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {error && <span className="mt-1 block text-sm text-red-400">{error}</span>}
    </label>
  );
}
