import { CreditCard, QrCode, Wallet } from "lucide-react";
import { WALLET_LABEL, type Payment } from "@/lib/types";

export function PaymentLabel({ payment }: { payment: Payment }) {
  if (payment.method === "pix") return <><QrCode className="size-4" /> PIX</>;
  if (payment.method === "wallet") return <><Wallet className="size-4" /> {WALLET_LABEL[payment.wallet]}</>;
  return <><CreditCard className="size-4" /> {payment.brand} •••• {payment.last4} ({payment.installments}x)</>;
}

export const paymentShort = (p: Payment) => (p.method === "pix" ? "PIX" : p.method === "wallet" ? WALLET_LABEL[p.wallet] : "Cartão");
