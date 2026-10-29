"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { formatPhone } from "@/lib/format";
import { login, register } from "@/lib/session";
import type { Customer } from "@/lib/types";

type Mode = "login" | "register";

export function AuthForm({ onSuccess, initialMode = "login" }: { onSuccess?: (c: Customer) => void; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [values, setValues] = useState({ name: "", email: "", phone: "", instagram: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      delete next.form;
      return next;
    });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = mode === "login" ? await login({ email: values.email, password: values.password }) : await register(values);
    setLoading(false);
    if (res.errors) return setErrors(res.errors);
    onSuccess?.(res.customer);
  }

  const field = (
    key: keyof typeof values,
    label: string,
    Icon: typeof User,
    props: React.InputHTMLAttributes<HTMLInputElement>,
    format: (v: string) => string = (v) => v,
  ) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          {...props}
          value={values[key]}
          onChange={(e) => set(key, format(e.target.value))}
          className={`input pl-12! ${key === "password" ? "pr-12!" : ""} ${errors[key] ? "border-red-500/70" : ""}`}
          aria-invalid={!!errors[key]}
        />
        {key === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-white"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </span>
      {errors[key] && <span className="mt-1 block text-sm text-red-400">{errors[key]}</span>}
    </label>
  );

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1.5">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setErrors({});
            }}
            className={`relative rounded-xl py-2.5 text-sm font-semibold transition ${mode === m ? "text-black" : "text-muted"}`}
          >
            {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-xl bg-brand" />}
            <span className="relative">{m === "login" ? "Entrar" : "Criar conta"}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <AnimatePresence initial={false}>
          {mode === "register" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {field("name", "Nome", User, { autoComplete: "name", placeholder: "Seu nome" })}
            </motion.div>
          )}
        </AnimatePresence>
        {field("email", "E-mail", Mail, { type: "email", autoComplete: "email", inputMode: "email", autoCapitalize: "none", placeholder: "voce@email.com" })}
        <AnimatePresence initial={false}>
          {mode === "register" && (
            <motion.div
              key="extra"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-4 overflow-hidden"
            >
              {field("phone", "Telefone (WhatsApp)", Phone, { autoComplete: "tel", inputMode: "tel", placeholder: "(11) 99999-9999" }, formatPhone)}
              {field("instagram", "Instagram", AtSign, { autoCapitalize: "none", autoCorrect: "off", placeholder: "seu.usuario" }, (v) =>
                v.replace(/^@+/, "").replace(/\s/g, ""),
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {field("password", "Senha", Lock, {
          type: showPassword ? "text" : "password",
          autoComplete: mode === "login" ? "current-password" : "new-password",
          placeholder: mode === "login" ? "Sua senha" : "Mínimo de 6 caracteres",
        })}

        {errors.form && <p className="text-sm text-red-400">{errors.form}</p>}

        <button disabled={loading} className="btn-brand mt-2">
          {loading && <Loader2 className="size-5 animate-spin" />}
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        <p className="text-center text-sm text-muted">
          {mode === "login" ? "Ainda não tem conta? " : "Já tem conta? "}
          <button
            type="button"
            className="font-semibold text-brand"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setErrors({});
            }}
          >
            {mode === "login" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </form>
    </div>
  );
}
