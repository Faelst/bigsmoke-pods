export type OrderStatus =
  | "aguardando_pagamento"
  | "pago"
  | "em_separacao"
  | "saiu_para_entrega"
  | "entregue"
  | "cancelado";

export type PaymentMethod = "pix" | "card";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  instagram: string;
  address?: Address; // último endereço usado, para preencher o checkout
  createdAt: string;
};

export type Address = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

export type GeoPoint = { lat: number; lng: number };

// Tabela no formato da Uber Flash: tarifa base + km + minuto, com mínimo.
export type DeliveryPricing = {
  base: number;
  perKm: number;
  perMin: number;
  minimum: number;
  extra: number; // taxa adicional da loja (embalagem, margem…)
  freeAbove: number; // frete grátis a partir deste subtotal (0 = desligado)
  maxKm: number; // raio máximo de entrega
};

export type DeliverySettings = {
  store: (Address & GeoPoint) | null;
  pricing: DeliveryPricing;
};

export type DeliveryQuote = { fee: number; distanceKm: number; durationMin: number; free: boolean };

// Como fica gravado no banco (nunca enviar ao cliente).
export type StoredCustomer = Customer & { passwordHash: string };

export type Admin = { id: string; name: string; email: string; passwordHash: string; createdAt: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  puffs: string;
  capacity: string;
  description: string;
  image: string;
  flavors: string[];
  badge?: string;
  active: boolean;
  createdAt: string;
};

export type OrderItem = {
  slug: string;
  name: string;
  flavor: string;
  price: number;
  qty: number;
  image: string;
};

export type Payment =
  | { method: "pix"; pixCode: string; expiresAt: string; paidAt?: string }
  | { method: "card"; brand: string; last4: string; installments: number; paidAt?: string };

export type Order = {
  id: string;
  code: string;
  customerId: string;
  items: OrderItem[];
  subtotal?: number; // pedidos antigos não têm entrega
  address?: Address & GeoPoint;
  delivery?: DeliveryQuote;
  trackingUrl?: string; // link de acompanhamento da corrida (Uber)
  total: number;
  payment: Payment;
  status: OrderStatus;
  history: { status: OrderStatus; at: string }[];
  createdAt: string;
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pagamento aprovado",
  em_separacao: "Em separação",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const STATUS_FLOW: OrderStatus[] = [
  "aguardando_pagamento",
  "pago",
  "em_separacao",
  "saiu_para_entrega",
  "entregue",
];
