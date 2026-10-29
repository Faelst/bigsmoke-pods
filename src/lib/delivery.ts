import "server-only";
import { query, transaction } from "./db";
import { deliveryFee, surgeAt } from "./delivery-pricing";
import { nowInStore, storeStatus } from "./hours";
import { geocode, GeoError, route } from "./geo";
import type { Address, DeliveryPricing, DeliverySettings, GeoPoint, StoreSettings } from "./types";

export class DeliveryError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const getDeliverySettings = () => query((db) => db.delivery);

// Com a loja fechada o pedido vira encomenda; a tarifa dinâmica segue a opção
// do admin (por padrão, a do horário em que a loja abre e a corrida é chamada).
export function deliveryTiming(delivery: DeliverySettings, settings: StoreSettings, date = new Date()) {
  const status = storeStatus(settings.hours, date, settings.closedUntil);
  if (status.open) return { surge: surgeAt(delivery.surges, nowInStore(date)), preorder: undefined };
  const mode = delivery.preorderSurge ?? "opening";
  const dispatchAt = mode === "opening" && status.opensAt ? new Date(status.opensAt) : date;
  const surge = mode === "none" ? 1 : mode === "always" ? (delivery.preorderMultiplier ?? 1) : surgeAt(delivery.surges, nowInStore(dispatchAt));
  return { surge, preorder: { opensAt: status.opensAt } };
}

type SurgeSettings = Pick<DeliverySettings, "surges" | "preorderSurge" | "preorderMultiplier">;

export function saveDeliverySettings(store: Address & GeoPoint, pricing: DeliveryPricing, surge: SurgeSettings) {
  return transaction((db) => (db.delivery = { store, pricing, ...surge }));
}

// Cota a entrega da loja até o endereço do cliente.
export async function quoteDelivery(address: Address, subtotal: number) {
  const { delivery, settings } = await query((db) => ({ delivery: db.delivery, settings: db.settings }));
  const { store, pricing } = delivery;
  if (!store) throw new DeliveryError("A loja ainda não configurou a entrega. Fale com a gente no WhatsApp.", 503);
  let point: GeoPoint;
  try {
    point = await geocode(address);
  } catch (e) {
    if (e instanceof GeoError) throw new DeliveryError(e.message, 422);
    throw e;
  }
  const r = await route(store, point);
  if (r.distanceKm > pricing.maxKm)
    throw new DeliveryError(`Ainda não entregamos neste endereço (${r.distanceKm.toFixed(1).replace(".", ",")} km da loja; atendemos até ${pricing.maxKm} km).`, 422);
  const { surge, preorder } = deliveryTiming(delivery, settings);
  return { quote: deliveryFee(pricing, r.distanceKm, r.durationMin, subtotal, surge), point, preorder };
}
