"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { AtSign, Mail, Search } from "lucide-react";
import { useAdminData } from "@/lib/admin-client";
import { brl, formatDate, formatPhone, onlyDigits } from "@/lib/format";
import { normalize } from "@/lib/products";
import { WhatsAppIcon } from "@/components/icons";
import { PageTitle } from "@/components/admin/ui";

type Row = {
  id: string; name: string; email: string; phone: string; instagram: string; createdAt: string;
  orders: number; spent: number; lastOrderAt: string | null;
};

export default function CustomersAdminPage() {
  const { data } = useAdminData<{ customers: Row[] }>("/api/admin/customers");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const term = normalize(q);
    const digits = onlyDigits(q);
    return (data?.customers ?? []).filter(
      (c) => !term || normalize(`${c.name} ${c.email} ${c.instagram}`).includes(term) || (digits.length >= 3 && c.phone.includes(digits)),
    );
  }, [data, q]);

  return (
    <>
      <PageTitle title="Clientes" subtitle={data ? `${data.customers.length} cadastrados` : undefined} />
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input className="input pl-12!" placeholder="Buscar por nome, e-mail, telefone ou Instagram" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {!data && [0, 1, 2, 3].map((i) => <li key={i} className="card h-36 animate-pulse" />)}
        {rows.map((c, i) => (
          <motion.li key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="card min-w-0 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand font-display text-lg text-black">{c.name[0]?.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="flex items-center gap-1.5 truncate text-sm text-muted"><Mail className="size-3.5 shrink-0" /> {c.email}</p>
                <p className="text-xs text-muted">Cliente desde {formatDate(c.createdAt).split(" ")[0]}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{brl(c.spent)}</p>
                <p className="text-xs text-muted">{c.orders} {c.orders === 1 ? "pedido" : "pedidos"}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href={`https://api.whatsapp.com/send?phone=55${c.phone}`} target="_blank" rel="noreferrer" className="btn-ghost py-2! text-xs">
                <WhatsAppIcon className="size-4 text-[#25D366]" /> {formatPhone(c.phone)}
              </a>
              <a href={`https://www.instagram.com/${c.instagram}`} target="_blank" rel="noreferrer" className="btn-ghost py-2! text-xs">
                <AtSign className="size-4 text-[#e1306c]" /> {c.instagram}
              </a>
            </div>
          </motion.li>
        ))}
      </ul>
      {data && rows.length === 0 && <p className="card mt-4 p-10 text-center text-muted">Nenhum cliente encontrado.</p>}
    </>
  );
}
