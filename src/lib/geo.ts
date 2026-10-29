import "server-only";
import type { Address, GeoPoint } from "./types";

// Serviços gratuitos e sem chave: ViaCEP (CEP), Nominatim/OpenStreetMap
// (endereço → coordenadas) e OSRM (rota de carro). Em produção com volume,
// prefira um provedor pago (Google Maps, Mapbox) ou o próprio Uber Direct.
const UA = "BigSmokePods/1.0 (marketplace)";
const TIMEOUT = 6000;

export class GeoError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new GeoError(`HTTP ${res.status}`);
  return res.json();
}

export async function lookupCep(cep: string) {
  const data = await getJson<{ erro?: boolean; logradouro: string; bairro: string; localidade: string; uf: string }>(
    `https://viacep.com.br/ws/${cep}/json/`,
  ).catch(() => null);
  if (!data || data.erro) return null;
  return { cep, street: data.logradouro, district: data.bairro, city: data.localidade, state: data.uf };
}

const geoCache = new Map<string, GeoPoint | null>();

async function nominatim(params: Record<string, string>): Promise<GeoPoint | null> {
  const qs = new URLSearchParams({ format: "json", limit: "1", countrycodes: "br", ...params });
  const [hit] = await getJson<{ lat: string; lon: string }[]>(`https://nominatim.openstreetmap.org/search?${qs}`);
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

// Tenta do mais preciso (rua + número) ao menos preciso (CEP, bairro).
export async function geocode(a: Address): Promise<GeoPoint> {
  const key = [a.cep, a.street, a.number, a.city, a.state].join("|").toLowerCase();
  if (geoCache.has(key)) {
    const hit = geoCache.get(key);
    if (hit) return hit;
    throw new GeoError("Não encontramos este endereço no mapa. Confira a rua e o número.");
  }
  const attempts: Record<string, string>[] = [
    { street: `${a.number} ${a.street}`, city: a.city, state: a.state },
    { street: a.street, city: a.city, state: a.state },
    { postalcode: a.cep.replace(/(\d{5})(\d{3})/, "$1-$2") },
    { q: `${a.district}, ${a.city}, ${a.state}` },
  ];
  let point: GeoPoint | null = null;
  try {
    for (const params of attempts) if ((point = await nominatim(params))) break;
  } catch {
    throw new GeoError("Serviço de mapas indisponível no momento. Tente novamente.");
  }
  geoCache.set(key, point);
  if (!point) throw new GeoError("Não encontramos este endereço no mapa. Confira a rua e o número.");
  return point;
}

function haversineKm(a: GeoPoint, b: GeoPoint) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Distância/tempo pelas ruas; se o OSRM falhar, estima pela linha reta.
export async function route(from: GeoPoint, to: GeoPoint): Promise<{ distanceKm: number; durationMin: number }> {
  try {
    const { routes } = await getJson<{ routes?: { distance: number; duration: number }[] }>(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`,
    );
    if (routes?.[0]) return { distanceKm: routes[0].distance / 1000, durationMin: routes[0].duration / 60 };
  } catch {}
  const distanceKm = haversineKm(from, to) * 1.35;
  return { distanceKm, durationMin: (distanceKm / 25) * 60 };
}
