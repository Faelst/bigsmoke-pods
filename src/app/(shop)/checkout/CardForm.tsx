"use client";

import { motion } from "motion/react";
import { useEffect, useImperativeHandle, useState, type Ref } from "react";
import { Loader2 } from "lucide-react";
import { brl, onlyDigits } from "@/lib/format";
import { mercadoPago, type SecureField } from "@/lib/mercadopago-client";
import { installmentOptions } from "@/lib/payment-fees";
import type { PaymentFees } from "@/lib/types";

// O que o servidor recebe: o cartão vira um token no Mercado Pago, o número nunca passa por aqui.
export type CardPayment = { token: string; paymentMethodId: string; installments: number; cpf: string; last4: string };
export type CardFormHandle = { tokenize: () => Promise<CardPayment> };

type FieldName = "cardNumber" | "expirationDate" | "securityCode";
type Method = { id: string; name: string; credit: boolean };

const formatCpf = (v: string) =>
  onlyDigits(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");

// Os campos do Mercado Pago são iframes: o estilo vai como opção, não por CSS.
const FIELD_STYLE = { color: "#f5f5f6", placeholderColor: "#9a9aa3b3", fontSize: "16px" };

export function CardForm({
  ref, total, fees, installments, onInstallments,
}: {
  ref: Ref<CardFormHandle>; total: number; fees: PaymentFees; installments: number; onInstallments: (n: number) => void;
}) {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [bin, setBin] = useState("");
  const [method, setMethod] = useState<Method | null>(null);
  const [focused, setFocused] = useState<FieldName | null>(null);
  const [invalid, setInvalid] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const options = installmentOptions(fees, total);
  // Próxima faixa que libera mais parcelas (tiers vêm ordenados pelo valor).
  const nextTier = fees.tiers.find((t) => t.minTotal > total && t.maxInstallments > options.length);

  useEffect(() => {
    let cancelled = false;
    const fields: SecureField[] = [];
    mercadoPago()
      .then((mp) => {
        if (cancelled) return;
        const create = (field: FieldName, container: string, placeholder: string, extra = {}) => {
          const f = mp.fields.create(field, { placeholder, style: FIELD_STYLE, ...extra }).mount(container);
          f.on("focus", () => setFocused(field));
          f.on("blur", () => setFocused((cur) => (cur === field ? null : cur)));
          f.on("validityChange", ({ errorMessages }) => setInvalid((v) => ({ ...v, [field]: (errorMessages as unknown[]).length > 0 })));
          fields.push(f);
          return f;
        };
        const number = create("cardNumber", "mp-card-number", "0000 0000 0000 0000");
        create("expirationDate", "mp-card-expiration", "MM/AA", { mode: "short" });
        const cvv = create("securityCode", "mp-card-cvv", "123");
        number.on("ready", () => !cancelled && setStatus("ready"));

        // Bandeira, emissor e tamanho do número/CVV a partir dos primeiros dígitos.
        number.on("binChange", async ({ bin: raw }) => {
          const b = String(raw ?? "");
          setBin(b);
          if (b.length < 6) return setMethod(null);
          try {
            const pm = (await mp.getPaymentMethods({ bin: b })).results[0];
            if (cancelled || !pm) return;
            const settings = pm.settings?.[0];
            if (settings?.card_number) number.update({ settings: settings.card_number });
            if (settings?.security_code) cvv.update({ settings: settings.security_code });
            setMethod({ id: pm.id, name: pm.name, credit: pm.payment_type_id === "credit_card" });
          } catch {
            if (!cancelled) setMethod(null);
          }
        });
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
      fields.forEach((f) => f.unmount());
    };
  }, []);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      if (status !== "ready") throw new Error("O formulário do cartão ainda não carregou");
      if (!method) throw new Error("Digite o número do cartão");
      if (!method.credit) throw new Error("Use um cartão de crédito");
      if (Object.values(invalid).some(Boolean)) throw new Error("Confira os dados do cartão");
      if (name.trim().length < 3) throw new Error("Informe o nome impresso no cartão");
      if (onlyDigits(cpf).length !== 11) throw new Error("Informe o CPF do titular do cartão");
      const mp = await mercadoPago();
      const token = await mp.fields
        .createCardToken({ cardholderName: name.trim(), identificationType: "CPF", identificationNumber: onlyDigits(cpf) })
        .catch(() => {
          throw new Error("Confira número, validade e CVV do cartão");
        });
      return { token: token.id, paymentMethodId: method.id, installments, cpf: onlyDigits(cpf), last4: token.last_four_digits ?? "" };
    },
  }));

  const box = (field: FieldName) =>
    `input flex h-[54px] items-center py-0! [&_iframe]:h-6 [&_iframe]:w-full ${focused === field ? "border-brand! ring-4 ring-brand/15" : ""} ${invalid[field] ? "border-red-500/70!" : ""}`;
  const masked = `${bin.slice(0, 4).padEnd(4, "•")} ${bin.slice(4, 8).padEnd(4, "•")} •••• ••••`;

  return (
    <div className="flex flex-col gap-5">
      {/* Cartão animado */}
      <div className="mx-auto w-full max-w-xs [perspective:1200px]">
        <motion.div
          animate={{ rotateY: focused === "securityCode" ? 180 : 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          className="relative aspect-[1.586] w-full [transform-style:preserve-3d]"
        >
          <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-brand via-brand-2 to-leaf-dark p-5 text-black shadow-2xl [backface-visibility:hidden]">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/25 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-100 to-yellow-500 shadow-inner" />
              <span className="text-sm font-bold italic">{method?.name ?? ""}</span>
            </div>
            <p className="relative font-mono text-lg tracking-widest">{masked}</p>
            <div className="relative flex justify-between text-xs font-semibold uppercase">
              <span className="truncate pr-2">{name || "Nome no cartão"}</span>
              <span>MM/AA</span>
            </div>
          </div>
          <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="mt-6 h-10 bg-black" />
            <div className="mx-5 mt-4 flex h-9 items-center justify-end rounded bg-white/90 px-3 font-mono text-black">•••</div>
          </div>
        </motion.div>
      </div>

      {status === "error" && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          Não foi possível carregar o pagamento com cartão. Verifique sua conexão ou pague com PIX.
        </p>
      )}

      <div className="block">
        <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-muted">
          Número do cartão {status === "loading" && <Loader2 className="size-3.5 animate-spin" />}
        </span>
        <div id="mp-card-number" className={box("cardNumber")} />
        {method && !method.credit && <span className="mt-1 block text-sm text-red-400">Aceitamos apenas cartão de crédito</span>}
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Nome impresso no cartão</span>
        <input className="input uppercase" autoComplete="cc-name" placeholder="NOME SOBRENOME" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Validade</span>
          <div id="mp-card-expiration" className={box("expirationDate")} />
        </div>
        <div className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">CVV</span>
          <div id="mp-card-cvv" className={box("securityCode")} />
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">CPF do titular</span>
        <input className="input" inputMode="numeric" placeholder="000.000.000-00" value={formatCpf(cpf)} onChange={(e) => setCpf(onlyDigits(e.target.value).slice(0, 11))} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">Parcelas</span>
        <select className="input appearance-none" value={installments} onChange={(e) => onInstallments(Number(e.target.value))}>
          {options.map((o) => (
            <option key={o.installments} value={o.installments}>
              {o.installments}x de {brl(o.each)}{o.fee > 0 ? ` (total ${brl(o.total)})` : " sem juros"}
            </option>
          ))}
        </select>
        {nextTier && (
          <span className="mt-1 block text-xs text-muted">
            Em compras a partir de {brl(nextTier.minTotal)}, parcele em até {nextTier.maxInstallments}x.
          </span>
        )}
      </label>
    </div>
  );
}
