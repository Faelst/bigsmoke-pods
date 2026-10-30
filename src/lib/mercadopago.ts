import "server-only";
import { MercadoPagoConfig, MPPaymentError, Order } from "mercadopago";
import type { CreateOrderRequest } from "mercadopago/dist/clients/order/create/types";
import type { OrderResponse } from "mercadopago/dist/clients/order/commonTypes";
import type { Contact, OrderItem } from "./types";

// Access Token só no servidor; a Public Key (NEXT_PUBLIC_MP_PUBLIC_KEY) vai para o navegador.
const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
export const mpConfigured = !!ACCESS_TOKEN;

// Checkout Transparente via API de Orders (/v1/orders): é a que as credenciais de teste aceitam.
const g = globalThis as unknown as { __bspMp?: MercadoPagoConfig };
const config = () => (g.__bspMp ??= new MercadoPagoConfig({ accessToken: ACCESS_TOKEN!, options: { timeout: 15_000 } }));
const orders = () => new Order(config());

export type MpOrder = OrderResponse;

const money = (n: number) => n.toFixed(2);

// extras: entrega e taxa de processamento, que também viram itens (a soma dos itens precisa bater com o total).
type Common = { orderId: string; code: string; total: number; contact: Contact & { email: string }; items: OrderItem[]; extras: { title: string; amount: number }[] };

function common({ orderId, code, total, contact, items, extras }: Common): CreateOrderRequest {
  const [first_name, ...last] = contact.name.split(" ");
  const lines = [
    ...items.map((i) => ({ title: `${i.name} (${i.flavor})`, unit_price: money(i.price), quantity: i.qty, external_code: i.slug })),
    ...extras.filter((e) => e.amount > 0).map((e) => ({ title: e.title, unit_price: money(e.amount), quantity: 1 })),
  ];
  return {
    type: "online",
    processing_mode: "automatic",
    total_amount: money(total),
    external_reference: orderId,
    description: `Pedido #${code} - Big Smoke Pods`,
    payer: { email: contact.email, first_name, last_name: last.join(" ") || undefined },
    items: lines,
  };
}

// O id do pedido serve de chave de idempotência: repetir a chamada não cobra duas vezes.
export function createPixOrder(input: Common & { minutes: number }) {
  return orders().create({
    body: {
      ...common(input),
      transactions: { payments: [{ amount: money(input.total), payment_method: { id: "pix", type: "bank_transfer" }, expiration_time: `PT${input.minutes}M` }] },
    },
    requestOptions: { idempotencyKey: `${input.orderId}-pix` },
  });
}

export type CardInput = { token: string; paymentMethodId: string; installments: number; cpf: string; last4: string };

// Cartão recusado: a API responde 402 e o SDK não repassa o motivo, então a order é buscada
// (ela leva alguns segundos para aparecer na busca).
async function rejection(orderId: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await new Promise((r) => setTimeout(r, 1_000));
    const now = Date.now();
    const found = await orders()
      .search({ options: { begin_date: new Date(now - 10 * 60_000).toISOString(), end_date: new Date(now + 60_000).toISOString(), external_reference: orderId } })
      .catch(() => null);
    const detail = found?.data?.[0]?.transactions?.payments?.[0]?.status_detail;
    if (detail) return detail;
  }
}

// Aprovado ou recusado na hora; recusado vira { approved: false, detail }.
export async function createCardOrder(input: Common & { card: CardInput }) {
  const base = common(input);
  try {
    const mp = await orders().create({
      body: {
        ...base,
        payer: { ...base.payer, identification: { type: "CPF", number: input.card.cpf } },
        config: { statement_descriptor: "BIGSMOKEPODS" },
        transactions: {
          payments: [{
            amount: money(input.total),
            payment_method: { id: input.card.paymentMethodId, type: "credit_card", token: input.card.token, installments: input.card.installments },
          }],
        },
      },
      requestOptions: { idempotencyKey: `${input.orderId}-card` },
    });
    return mp.status === "processed" ? { approved: true as const, mp } : { approved: false as const, detail: mp.transactions?.payments?.[0]?.status_detail };
  } catch (e) {
    if (e instanceof MPPaymentError) return { approved: false as const, detail: await rejection(input.orderId) };
    throw e;
  }
}

export const getMpOrder = (id: string) => orders().get({ id });

// Estorna um cartão aprovado ou cancela um PIX ainda não pago.
export async function undoMpOrder(id: string, refund: boolean) {
  if (refund) await orders().refund({ id, requestOptions: { idempotencyKey: `${id}-refund` } });
  else await orders().cancel({ id });
}

// Mensagem para o cliente a partir do status_detail de um cartão recusado.
export function rejectionMessage(detail?: string) {
  switch (detail) {
    case "insufficient_amount":
      return "Saldo ou limite insuficiente. Tente outro cartão ou pague com PIX.";
    case "bad_filled_security_code":
      return "Código de segurança (CVV) inválido. Confira e tente de novo.";
    case "bad_filled_date":
      return "Validade do cartão inválida. Confira e tente de novo.";
    case "bad_filled_card_data":
    case "bad_filled_card_number":
    case "bad_filled_other":
      return "Confira os dados do cartão e tente de novo.";
    case "call_for_authorize":
      return "O banco pediu autorização: libere a compra no app do banco e tente de novo.";
    case "card_disabled":
      return "Cartão bloqueado ou não habilitado. Fale com o banco ou use outro cartão.";
    case "duplicated_payment":
      return "Pagamento repetido: já existe uma compra igual há pouco. Use outro cartão se quiser comprar de novo.";
    case "max_attempts":
    case "max_attempts_exceeded":
      return "Limite de tentativas atingido. Use outro cartão ou pague com PIX.";
    case "invalid_installments":
      return "Este cartão não aceita esse número de parcelas.";
    default:
      return "Pagamento recusado pela operadora. Tente outro cartão ou pague com PIX.";
  }
}
