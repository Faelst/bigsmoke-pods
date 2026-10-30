"use client";

import { loadMercadoPago } from "@mercadopago/sdk-js";

// Só o que o checkout usa do MercadoPago.js v2 (o pacote não traz tipos).
export type SecureField = {
  mount: (containerId: string) => SecureField;
  unmount: () => void;
  on: (event: string, cb: (data: Record<string, unknown>) => void) => SecureField;
  update: (props: Record<string, unknown>) => void;
};
type PaymentMethodResult = {
  id: string;
  name: string;
  payment_type_id: string;
  issuer?: { id: number; name: string };
  settings?: { card_number?: { length: number }; security_code?: { length: number } }[];
};
export type MercadoPagoJs = {
  fields: {
    create: (field: "cardNumber" | "expirationDate" | "securityCode", options?: Record<string, unknown>) => SecureField;
    createCardToken: (data: { cardholderName: string; identificationType: string; identificationNumber: string }) => Promise<{
      id: string;
      last_four_digits?: string;
    }>;
  };
  getPaymentMethods: (params: { bin: string }) => Promise<{ results: PaymentMethodResult[] }>;
  getIssuers: (params: { paymentMethodId: string; bin: string }) => Promise<{ id: string; name: string }[]>;
};

export const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "";

let instance: Promise<MercadoPagoJs> | null = null;

// Uma instância por página; o script vem do CDN do Mercado Pago.
export function mercadoPago() {
  instance ??= loadMercadoPago()
    .then(() => {
      const MP = (window as unknown as { MercadoPago: new (key: string, opts: object) => MercadoPagoJs }).MercadoPago;
      return new MP(MP_PUBLIC_KEY, { locale: "pt-BR" });
    })
    .catch((e) => {
      instance = null;
      throw e;
    });
  return instance;
}
