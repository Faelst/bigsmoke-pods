import "server-only";
import { query, transaction } from "./db";
import { deliveryFee } from "./delivery-pricing";
import { geocode, GeoError, route } from "./geo";
import type { Address, DeliveryPricing, GeoPoint } from "./types";

export class DeliveryError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const getDeliverySettings = () => query((db) => db.delivery);

export function saveDeliverySettings(store: Address & GeoPoint, pricing: DeliveryPricing) {
  return transaction((db) => (db.delivery = { store, pricing }));
}

// Cota a entrega da loja até o endereço do cliente.
export async function quoteDelivery(address: Address, subtotal: number) {
  const { store, pricing } = await getDeliverySettings();
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
  return { quote: deliveryFee(pricing, r.distanceKm, r.durationMin, subtotal), point };
}
