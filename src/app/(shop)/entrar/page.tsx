"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md px-4 pt-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-6 sm:p-8">
        <Image src="/brand/logo.png" alt="" width={72} height={72} className="mx-auto rounded-2xl" />
        <h1 className="mt-4 text-center font-display text-2xl">Minha conta</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted">Entre com seu e-mail ou crie sua conta em segundos.</p>
        <AuthForm
          onSuccess={() => {
            const next = new URLSearchParams(window.location.search).get("next");
            router.replace(next?.startsWith("/") ? next : "/conta");
          }}
        />
      </motion.div>
    </div>
  );
}
