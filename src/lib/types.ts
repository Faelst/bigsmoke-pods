export type OrderStatus =
  | "aguardando_pagamento"
  | "pago"
  | "em_separacao"
  | "saiu_para_entrega"
  | "entregue"
  | "cancelado";

export type Wallet = "apple_pay" | "google_pay";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  instagram: string;
  address?: Address; // último endereço usado, para preencher o checkout
  createdAt: string;
};

// Tipo do local de entrega (só no endereço do cliente; o da loja não tem).
export type AddressKind = "casa" | "apartamento" | "outro";

export type Address = {
  kind?: AddressKind;
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

// Tarifa dinâmica: entre start e end (HH:MM, horário de Brasília) a corrida
// é multiplicada. Se end < start, a faixa atravessa a meia-noite.
export type DeliverySurge = { start: string; end: string; multiplier: number };

// Tarifa dinâmica nas encomendas (loja fechada): a do horário de abertura,
// a do horário do pedido, sempre um multiplicador fixo ou nenhuma.
export type PreorderSurge = "opening" | "now" | "always" | "none";

export type DeliverySettings = {
  store: (Address & GeoPoint) | null;
  pricing: DeliveryPricing;
  surges?: DeliverySurge[];
  preorderSurge?: PreorderSurge;
  preorderMultiplier?: number; // usado em "always"
};

// Horário de funcionamento por dia da semana (índice 0 = domingo), horário de
// Brasília. start === end = aberto 24h; end < start = fecha depois da meia-noite.
export type DayHours = { open: boolean; start: string; end: string };

export type SocialLinks = { whatsapp: string; instagram: string; tiktok: string };

// closedUntil: loja fechada manualmente até esse instante (reabre sozinha).
// teamPhones: WhatsApp da equipe (com 55): recebem o aviso de pedido pago e podem mandar /ras.
export type StoreSettings = { hours: DayHours[]; social: SocialLinks; closedUntil?: string | null; teamPhones?: string[] };

// Situação da loja agora; opensAt = próxima abertura (null se nunca abre).
export type StoreStatus = { open: boolean; opensAt: string | null; manual?: boolean };

export type DeliveryQuote = { fee: number; distanceKm: number; durationMin: number; free: boolean; surge?: number };

// Como fica gravado no banco (nunca enviar ao cliente).
export type StoredCustomer = Customer & { passwordHash: string };

export type Admin = { id: string; name: string; email: string; passwordHash: string; createdAt: string };

// stock: unidades em estoque (só sai do estoque quando o pagamento é confirmado).
// reserved: unidades em PIX aguardando pagamento (só na listagem do admin). Na loja, stock já
// vem descontado do que está reservado.
export type Flavor = { name: string; stock: number; reserved?: number };

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
  flavors: Flavor[];
  badge?: string; // selo livre (ex.: "Promo")
  bestseller?: boolean; // selo e filtro "Mais vendidos"
  isNew?: boolean; // selo e filtro "Novidades"
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

// mpId/mpStatus: pagamento no Mercado Pago (pedidos de demonstração não têm).
// "wallet" só existe em pedidos antigos, da fase de demonstração.
type MpPayment = { mpId?: string; mpStatus?: string; paidAt?: string };
export type Payment =
  | ({ method: "pix"; pixCode: string; expiresAt: string; ticketUrl?: string } & MpPayment)
  | ({ method: "card"; brand: string; last4: string; installments: number } & MpPayment)
  | ({ method: "wallet"; wallet: Wallet } & MpPayment);

// Quem recebe o pedido (compra sem conta: nome, WhatsApp e e-mail do pagador).
export type Contact = { name: string; phone: string; email?: string };

// A partir de minTotal (total do pedido, sem a taxa) o cartão parcela em até maxInstallments.
export type InstallmentTier = { minTotal: number; maxInstallments: number };

// Taxa de processamento, em % sobre o total do pedido. cardPercent[0] = 1x, [1] = 2x…
export type PaymentFees = { pixPercent: number; cardPercent: number[]; tiers: InstallmentTier[] };

// Cupom de desconto. Só um por pedido.
// validUntil: último dia em que vale (AAAA-MM-DD, horário de Brasília).
// maxUses / maxPerEmail: 0 = sem limite. Um uso conta enquanto o PIX aguarda pagamento
// (reserva) e de vez quando o pagamento é confirmado; pedido cancelado ou PIX expirado libera o uso.
export type CouponKind = "free_shipping" | "percent";
export type Coupon = {
  id: string;
  code: string; // sempre em maiúsculas
  kind: CouponKind;
  percent?: number; // só em "percent": desconto sobre os produtos (sem o frete)
  validUntil: string;
  maxUses: number;
  maxPerEmail: number;
  active: boolean;
  createdAt: string;
};

// O que o checkout recebe ao validar um código.
export type CouponOffer = Pick<Coupon, "code" | "kind" | "percent">;

// Gravado no pedido. discount: quanto o cupom abateu (no frete grátis, o valor da entrega).
export type OrderCoupon = CouponOffer & { id: string; discount: number };

// No admin: usos confirmados (pagos) e reservados (PIX aguardando pagamento).
export type AdminCoupon = Coupon & { used: number; reserved: number };

// Entrega por motoboy (padrão; pedidos antigos não têm o campo) ou retirada no local, sem frete.
export type Fulfillment = "delivery" | "pickup";

export type Order = {
  id: string;
  code: string;
  fulfillment?: Fulfillment;
  customerId?: string; // só quando comprou logado
  contact?: Contact; // pedidos antigos (antes da compra sem conta) não têm
  items: OrderItem[];
  subtotal?: number; // pedidos antigos não têm entrega
  address?: Address & GeoPoint;
  delivery?: DeliveryQuote;
  trackingUrl?: string; // link de acompanhamento da corrida (Uber)
  preorder?: { opensAt: string | null }; // feito com a loja fechada: envio na abertura
  coupon?: OrderCoupon; // desconto já abatido do total
  paymentFee?: number; // taxa de processamento do pagamento, já somada ao total
  total: number;
  payment: Payment;
  stockDebited?: boolean; // itens já descontados do estoque (pagamento confirmado)
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

// O que a busca por telefone mostra: sem nome nem endereço. O id (link com os
// detalhes) só vem para os pedidos que o próprio aparelho já conhece.
export type OrderSummary = Pick<Order, "code" | "status" | "total" | "createdAt" | "preorder"> & {
  id?: string;
  items: Pick<OrderItem, "name" | "flavor" | "qty" | "image">[];
};

export const WALLET_LABEL: Record<Wallet, string> = { apple_pay: "Apple Pay", google_pay: "Google Pay" };
