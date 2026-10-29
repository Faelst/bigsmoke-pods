"use client";

import { motion } from "motion/react";
import { Check, Clock, PackageCheck, Truck, Wallet, XCircle, Box } from "lucide-react";
import { formatDate } from "@/lib/format";
import { STATUS_FLOW, STATUS_LABEL, type Order, type OrderStatus } from "@/lib/types";

const STYLE: Record<OrderStatus, string> = {
  aguardando_pagamento: "bg-brand/15 text-brand border-brand/30",
  pago: "bg-sky-500/15 text-sky-300 border-sky-400/30",
  em_separacao: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  saiu_para_entrega: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  entregue: "bg-leaf/15 text-leaf border-leaf/30",
  cancelado: "bg-red-500/15 text-red-300 border-red-400/30",
};

const ICON = {
  aguardando_pagamento: Clock,
  pago: Wallet,
  em_separacao: Box,
  saiu_para_entrega: Truck,
  entregue: PackageCheck,
  cancelado: XCircle,
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon = ICON[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${STYLE[status]}`}>
      <Icon className="size-3.5" /> {STATUS_LABEL[status]}
    </span>
  );
}

export function StatusTimeline({ order }: { order: Order }) {
  if (order.status === "cancelado") {
    return <p className="text-sm text-red-300">Pedido cancelado.</p>;
  }
  const current = STATUS_FLOW.indexOf(order.status);
  return (
    <ol className="relative flex flex-col gap-5">
      {STATUS_FLOW.map((s, i) => {
        const done = i <= current;
        const at = order.history.findLast((h) => h.status === s)?.at;
        const Icon = ICON[s];
        return (
          <motion.li
            key={s}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="relative flex items-center gap-4"
          >
            {i < STATUS_FLOW.length - 1 && (
              <span className="absolute left-[19px] top-10 h-5 w-0.5 overflow-hidden bg-line">
                <motion.span
                  className="block h-full w-full bg-leaf"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: i < current ? 1 : 0 }}
                  style={{ originY: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                />
              </span>
            )}
            <span
              className={`relative grid size-10 shrink-0 place-items-center rounded-full border-2 transition ${
                done ? "border-leaf bg-leaf text-black" : "border-line text-muted"
              } ${i === current ? "ring-4 ring-leaf/25" : ""}`}
            >
              {done && i < current ? <Check className="size-5" /> : <Icon className="size-5" />}
            </span>
            <div>
              <p className={done ? "font-semibold" : "text-muted"}>{STATUS_LABEL[s]}</p>
              {at && <p className="text-xs text-muted">{formatDate(at)}</p>}
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
