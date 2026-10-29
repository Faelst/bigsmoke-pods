"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      setLoading(false);
      return setError((await res.json()).error);
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next?.startsWith("/admin") ? next : "/admin");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_top,rgb(255_178_0/0.12),transparent_60%)] p-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card w-full max-w-sm p-7"
      >
        <Image src="/brand/logo.png" alt="" width={64} height={64} className="mx-auto rounded-2xl" />
        <h1 className="mt-4 flex items-center justify-center gap-2 font-display text-xl">
          <ShieldCheck className="size-5 text-brand" /> Painel admin
        </h1>
        <div className="mt-6 flex flex-col gap-4">
          <label className="relative block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
            <input className="input pl-12!" type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="relative block">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
            <input className="input pl-12!" type="password" autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={loading} className="btn-brand">
            {loading && <Loader2 className="size-5 animate-spin" />} Entrar
          </button>
        </div>
      </motion.form>
    </main>
  );
}
