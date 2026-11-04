"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Fence, Home, Loader2, MapPin, MapPinned } from "lucide-react";
import { ADDRESS_KINDS, DROPOFF_LABEL, dropoffsFor, formatCep } from "@/lib/delivery-pricing";
import { onlyDigits } from "@/lib/format";
import type { Address, AddressKind } from "@/lib/types";

export const EMPTY_ADDRESS: Address = { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };

export const isAddressComplete = (a: Address) =>
  onlyDigits(a.cep).length === 8 && !!a.street.trim() && !!a.number.trim() && !!a.district.trim() && !!a.city.trim() && a.state.length === 2;

const KIND_ICON: Record<AddressKind, typeof Home> = { casa: Home, apartamento: Building2, condominio: Fence, outro: MapPinned };

// CEP → busca automática da rua/bairro/cidade; cliente completa número e complemento.
// withKind (entrega do cliente): escolhe casa/apartamento/condomínio/outro e o complemento vira obrigatório;
// em condomínio e apartamento, escolhe também como receber (portaria ou em casa).
export function AddressFields({
  value, onChange, errors = {}, withKind = false,
}: { value: Address; onChange: (a: Address) => void; errors?: Record<string, string>; withKind?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const filled = !!value.street || !!cepError;
  const kind = ADDRESS_KINDS.find((k) => k.id === value.kind);
  const dropoffs = dropoffsFor(value.kind);
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
            {withKind && (
              <div className="col-span-6">
                <span className="mb-1.5 block text-sm font-medium text-muted">Tipo do endereço</span>
                <div role="radiogroup" aria-label="Tipo do endereço" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ADDRESS_KINDS.map((k) => {
                    const Icon = KIND_ICON[k.id];
                    const on = value.kind === k.id;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        // Trocar o tipo zera o "como receber" se a opção não existir no novo tipo.
                        onClick={() => set({ kind: k.id, dropoff: value.dropoff && dropoffsFor(k.id).includes(value.dropoff) ? value.dropoff : undefined })}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                          on ? "border-brand bg-brand/10 text-white" : "border-line text-muted hover:text-white"
                        }`}
                      >
                        <Icon className={`size-4 shrink-0 ${on ? "text-brand" : ""}`} /> {k.label}
                      </button>
                    );
                  })}
                </div>
                {errors.kind && <span className="mt-1 block text-sm text-red-400">{errors.kind}</span>}
              </div>
            )}
            {withKind && dropoffs.length > 0 && (
              <div className="col-span-6">
                <span className="mb-1.5 block text-sm font-medium text-muted">Como você quer receber?</span>
                <div role="radiogroup" aria-label="Como receber" className={`grid gap-2 ${dropoffs.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                  {dropoffs.map((d) => {
                    const on = value.dropoff === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set({ dropoff: d })}
                        className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                          on ? "border-brand bg-brand/10 text-white" : "border-line text-muted hover:text-white"
                        }`}
                      >
                        {DROPOFF_LABEL[d]}
                      </button>
                    );
                  })}
                </div>
                {errors.dropoff && <span className="mt-1 block text-sm text-red-400">{errors.dropoff}</span>}
              </div>
            )}
            <Input className="col-span-2" label="Número" inputRef={numberRef} value={value.number} onChange={(v) => set({ number: v })} error={errors.number} />
            {withKind ? (
              <Input
                className="col-span-4"
                label={kind ? `Complemento (${kind.label.toLowerCase()})` : "Complemento"}
                placeholder={kind?.hint ?? "Escolha o tipo do endereço acima"}
                autoComplete="address-line2"
                value={value.complement}
                onChange={(v) => set({ complement: v })}
                error={errors.complement}
              />
            ) : (
              <Input className="col-span-4" label="Complemento" placeholder="Apto, bloco… (opcional)" autoComplete="address-line2" value={value.complement} onChange={(v) => set({ complement: v })} />
            )}
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
