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
export type AddressKind = "casa" | "apartamento" | "condominio" | "outro";

// Como receber, em condomínio e apartamento: deixar com o porteiro, descer até a portaria
// ou (só condomínio de casas) o motoboy entrar até a casa.
export type Dropoff = "deixar_portaria" | "receber_portaria" | "receber_casa";

export type Address = {
  kind?: AddressKind;
  dropoff?: Dropoff;
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
// "manual": venda feita por fora da loja (WhatsApp, balcão) e lançada no painel; via = como o cliente pagou.
export type ManualVia = "pix" | "card";
type MpPayment = { mpId?: string; mpStatus?: string; paidAt?: string };
export type Payment =
  | ({ method: "pix"; pixCode: string; expiresAt: string; ticketUrl?: string } & MpPayment)
  | ({ method: "card"; brand: string; last4: string; installments: number } & MpPayment)
  | ({ method: "wallet"; wallet: Wallet } & MpPayment)
  | ({ method: "manual"; via: ManualVia } & MpPayment) // nunca tem mpId
  // Pedido zerado pelo pod do mês da assinatura (retirada no local): nada a cobrar.
  | ({ method: "subscription" } & MpPayment)
  // Pedido zerado por cupom (ex.: 100% com retirada no local): nada a cobrar.
  | ({ method: "coupon" } & MpPayment);

// Quem recebe o pedido (compra sem conta: nome, WhatsApp e e-mail do pagador).
export type Contact = { name: string; phone: string; email?: string };

// A partir de minTotal (total do pedido, sem a taxa) o cartão parcela em até maxInstallments.
export type InstallmentTier = { minTotal: number; maxInstallments: number };

// Taxa de processamento, em % sobre o total do pedido. cardPercent[0] = 1x, [1] = 2x…
export type PaymentFees = { pixPercent: number; cardPercent: number[]; tiers: InstallmentTier[] };

// Cupom de desconto. Só um por pedido.
// validUntil: último dia em que vale (AAAA-MM-DD, horário de Brasília).
// maxUses / maxPerPhone: 0 = sem limite (por cliente = pelo número de WhatsApp do pedido). Um uso conta enquanto o PIX aguarda pagamento
// (reserva) e de vez quando o pagamento é confirmado; pedido cancelado ou PIX expirado libera o uso.
export type CouponKind = "free_shipping" | "percent" | "fixed";
export type Coupon = {
  id: string;
  code: string; // sempre em maiúsculas
  kind: CouponKind;
  percent?: number; // só em "percent": desconto sobre os produtos (sem o frete)
  amount?: number; // só em "fixed": R$ abatidos dos produtos (no máximo o valor deles)
  freeShipping?: boolean; // só em "percent" e "fixed": além do desconto, zera a entrega
  validUntil: string;
  maxUses: number;
  maxPerPhone: number;
  // Só na primeira compra do WhatsApp: quem já tem um pedido pago (ou PIX em aberto) não pode usar.
  firstPurchaseOnly?: boolean;
  active: boolean;
  createdAt: string;
};

// O que o checkout recebe ao validar um código.
export type CouponOffer = Pick<Coupon, "code" | "kind" | "percent" | "amount" | "freeShipping">;

// Gravado no pedido. discount: quanto o cupom abateu (no frete grátis, o valor da entrega;
// no desconto com frete grátis junto, só a parte dos produtos).
export type OrderCoupon = CouponOffer & { id: string; discount: number };

// No admin: usos confirmados (pagos) e reservados (PIX aguardando pagamento).
export type AdminCoupon = Coupon & { used: number; reserved: number };

// ---- Assinatura ----

// Plano único, configurado no admin.
export type SubscriptionPlan = {
  enabled: boolean; // desligado: ninguém novo assina (quem já assina continua)
  price: number; // mensalidade
  podLimit: number; // valor máximo do pod do mês; pod mais caro paga a diferença
  secondPodPercent: number; // desconto no 2º pod do ciclo
  minMonths: number; // fidelidade: o cliente só cancela pelo site depois de N mensalidades pagas (0 = sem)
};

// pendente: aguardando a 1ª cobrança. suspensa: mensalidade não paga (ou estornada). Os benefícios
// não dependem do status e sim de haver um ciclo pago em vigor (assinatura cancelada vale até o fim dele).
export type SubscriptionStatus = "pendente" | "ativa" | "suspensa" | "cancelada";

// Um ciclo = uma mensalidade paga (id da fatura no Mercado Pago). Vale 1 mês a partir do pagamento.
// reversed: pagamento estornado ou contestado depois, o ciclo deixa de valer.
export type SubscriptionCycle = { id: string; paidAt: string; endsAt: string; amount: number; reversed?: boolean };

export type Subscription = {
  id: string;
  customerId: string;
  mpId: string; // preapproval no Mercado Pago
  mpStatus?: string;
  status: SubscriptionStatus;
  price: number;
  minMonths: number; // fidelidade combinada ao assinar
  card: { brand: string; last4: string };
  cycles: SubscriptionCycle[];
  nextChargeAt?: string;
  syncedAt?: string;
  createdAt: string;
  cancelledAt?: string;
  cancelledBy?: "customer" | "admin" | "mercadopago";
};

// O que o assinante ainda tem no ciclo em vigor (igual no checkout e no servidor).
export type SubscriberBenefit = {
  subscriptionId: string;
  cycle: string;
  endsAt: string;
  freePod: boolean; // pod do mês ainda não usado
  secondPod: boolean; // desconto do 2º pod ainda não usado
  podLimit: number;
  percent: number;
};

// Gravado no pedido. freePod / secondPod: quanto cada benefício abateu dos produtos.
export type OrderSubscription = { id: string; cycle: string; freePod: number; secondPod: number; percent: number; discount: number };

// O que o cliente vê em /assinatura.
export type SubscriptionView = {
  status: SubscriptionStatus;
  price: number;
  card: { brand: string; last4: string };
  createdAt: string;
  nextChargeAt?: string;
  paidMonths: number;
  benefit: SubscriberBenefit | null;
  canCancel: boolean;
  cancelAfterMonths: number; // mensalidades que faltam para poder cancelar pelo site
};

// Entrega por motoboy (padrão; pedidos antigos não têm o campo) ou retirada no local, sem frete.
export type Fulfillment = "delivery" | "pickup";

export type Order = {
  id: string;
  code: string;
  fulfillment?: Fulfillment;
  customerId?: string; // só quando comprou logado
  // Pedidos antigos (antes da compra sem conta) não têm. Na venda manual é opcional e o telefone pode vir vazio.
  contact?: Contact;
  items: OrderItem[];
  subtotal?: number; // pedidos antigos não têm entrega
  address?: Address & GeoPoint;
  delivery?: DeliveryQuote;
  trackingUrl?: string; // link de acompanhamento da corrida (Uber) em uso agora
  // Links anteriores, do mais antigo ao mais recente (a Uber cancelou e outra corrida foi chamada).
  previousTracking?: { url: string; replacedAt: string }[];
  preorder?: { opensAt: string | null }; // feito com a loja fechada: envio na abertura
  coupon?: OrderCoupon; // desconto já abatido do total
  subscription?: OrderSubscription; // benefícios do assinante, já abatidos do total (não acumula com cupom)
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
