import { onlyDigits } from "./format";
import { nowInStore, TIME_RE, toMinutes } from "./hours";
import type { Address, DeliveryPricing, DeliveryQuote, DeliverySurge } from "./types";

// Valores de referência públicos da Uber Flash (podem estar desatualizados e
// variam por cidade/demanda) — o admin ajusta tudo no painel.
export const UBER_PRESETS = {
  moto: {
    label: "Uber Flash Moto",
    pricing: { base: 1.4, perKm: 1.01, perMin: 0.12, minimum: 7, extra: 0, freeAbove: 0, maxKm: 15 },
  },
  carro: {
    label: "Uber Flash Carro",
    pricing: { base: 1.98, perKm: 1.34, perMin: 0.16, minimum: 9, extra: 0, freeAbove: 0, maxKm: 25 },
  },
} satisfies Record<string, { label: string; pricing: DeliveryPricing }>;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Mesma conta do app: base + km + minutos, nunca abaixo do mínimo; a tarifa
// dinâmica multiplica a corrida (a taxa adicional da loja não).
// A conta usa a distância e os minutos já arredondados (os que a cotação guarda e o cliente vê):
// recalcular o pedido a partir da cotação dá exatamente o frete mostrado no checkout.
export function deliveryFee(p: DeliveryPricing, distanceKm: number, durationMin: number, subtotal = 0, surge = 1): DeliveryQuote {
  const km = round2(distanceKm);
  const min = Math.max(1, Math.round(durationMin));
  const free = p.freeAbove > 0 && subtotal >= p.freeAbove;
  const ride = Math.max(p.minimum, p.base + p.perKm * km + p.perMin * min) * surge;
  return {
    fee: free ? 0 : round2(ride + p.extra),
    distanceKm: km,
    durationMin: min,
    free,
    ...(surge !== 1 && { surge }),
  };
}

// Multiplicador da faixa ativa no horário (o maior, se houver sobreposição).
export function surgeAt(surges: DeliverySurge[] = [], hhmm = nowInStore()) {
  const t = toMinutes(hhmm);
  return surges.reduce((max, s) => {
    const start = toMinutes(s.start);
    const end = toMinutes(s.end);
    const active = start <= end ? t >= start && t < end : t >= start || t < end;
    return active ? Math.max(max, s.multiplier) : max;
  }, 1);
}

export const formatCep = (v: string) => {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const formatAddress = (a: Address) =>
  `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""} - ${a.district}, ${a.city}/${a.state} - CEP ${formatCep(a.cep)}`;

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function parseAddress(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const data: Address = {
    cep: onlyDigits(str(b.cep, 12)),
    street: str(b.street, 120),
    number: str(b.number, 10),
    complement: str(b.complement, 60),
    district: str(b.district, 80),
    city: str(b.city, 80),
    state: str(b.state, 2).toUpperCase(),
  };
  const errors: Record<string, string> = {};
  if (data.cep.length !== 8) errors.cep = "CEP inválido";
  if (data.street.length < 2) errors.street = "Informe a rua";
  if (!data.number) errors.number = "Informe o número";
  if (data.district.length < 2) errors.district = "Informe o bairro";
  if (data.city.length < 2) errors.city = "Informe a cidade";
  if (!/^[A-Z]{2}$/.test(data.state)) errors.state = "UF inválida";
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

export function parsePricing(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const keys = ["base", "perKm", "perMin", "minimum", "extra", "freeAbove", "maxKm"] as const;
  const errors: Record<string, string> = {};
  const data = {} as DeliveryPricing;
  for (const k of keys) {
    const n = Number(String(b[k] ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 10_000) errors[k] = "Valor inválido";
    data[k] = round2(n);
  }
  if (!errors.maxKm && data.maxKm < 1) errors.maxKm = "Mínimo de 1 km";
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

export function parseSurges(body: unknown) {
  const list = Array.isArray(body) ? body.slice(0, 20) : [];
  const errors: Record<string, string> = {};
  const data: DeliverySurge[] = list.map((raw, i) => {
    const b = (raw ?? {}) as Record<string, unknown>;
    const s = { start: str(b.start, 5), end: str(b.end, 5), multiplier: round2(Number(String(b.multiplier ?? "").replace(",", "."))) };
    if (!TIME_RE.test(s.start) || !TIME_RE.test(s.end) || s.start === s.end) errors[`surge${i}`] = "Horário inválido";
    else if (!Number.isFinite(s.multiplier) || s.multiplier <= 0 || s.multiplier > 10) errors[`surge${i}`] = "Multiplicador entre 0,1 e 10";
    return s;
  });
  return { data, errors, ok: Object.keys(errors).length === 0 };
}
