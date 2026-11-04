import "server-only";
import type { Address, GeoPoint } from "./types";

// Serviços gratuitos e sem chave, com redundância: se um falhar (erro, timeout
// ou não encontrar), o próximo da lista é chamado.
//   CEP → endereço:      ViaCEP → BrasilAPI → AwesomeAPI
//   endereço → ponto:    Nominatim → Photon → AwesomeAPI (CEP) → bairro
//   rota de carro:       OSRM (project-osrm) → OSRM (FOSSGIS) → linha reta
// Em produção com volume, prefira um provedor pago (Google Maps, Mapbox) ou o próprio Uber Direct.
const UA = "BigSmokePods/1.0 (marketplace)";
const TIMEOUT = 6000;

export class GeoError extends Error {}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new GeoError(`HTTP ${res.status}`);
  return res.json();
}

type Provider<T> = { name: string; run: () => Promise<T | null> };

/**
 * Chama os provedores em ordem até um devolver resultado.
 * `allFailed` indica que todos deram erro (serviço fora), e não só "não encontrado".
 */
async function firstOf<T>(providers: Provider<T>[]): Promise<{ value: T | null; allFailed: boolean }> {
  let failures = 0;
  for (const p of providers) {
    try {
      const value = await p.run();
      if (value) return { value, allFailed: false };
    } catch (e) {
      failures++;
      console.warn(`[geo] ${p.name} falhou:`, e instanceof Error ? e.message : e);
    }
  }
  return { value: null, allFailed: failures === providers.length };
}

const digits = (s: string) => s.replace(/\D/g, "");
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const toPoint = (lat: unknown, lng: unknown): GeoPoint | null => {
  const p = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat || p.lng) ? p : null;
};

// ---------- CEP → endereço ----------

type CepAddress = { cep: string; street: string; district: string; city: string; state: string };

export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const c = digits(cep);
  const { value } = await firstOf<CepAddress>([
    {
      name: "ViaCEP",
      run: async () => {
        const d = await getJson<{ erro?: boolean | string; logradouro: string; bairro: string; localidade: string; uf: string }>(
          `https://viacep.com.br/ws/${c}/json/`,
        );
        return d.erro ? null : { cep, street: d.logradouro, district: d.bairro, city: d.localidade, state: d.uf };
      },
    },
    {
      name: "BrasilAPI",
      run: async () => {
        const d = await getJson<{ street?: string; neighborhood?: string; city?: string; state?: string }>(
          `https://brasilapi.com.br/api/cep/v2/${c}`,
        );
        return d.city && d.state ? { cep, street: d.street ?? "", district: d.neighborhood ?? "", city: d.city, state: d.state } : null;
      },
    },
    {
      name: "AwesomeAPI",
      run: async () => {
        const d = await getJson<{ address?: string; district?: string; city?: string; state?: string }>(
          `https://cep.awesomeapi.com.br/json/${c}`,
        );
        return d.city && d.state ? { cep, street: d.address ?? "", district: d.district ?? "", city: d.city, state: d.state } : null;
      },
    },
  ]);
  return value;
}

// ---------- endereço → coordenada ----------

async function nominatim(params: Record<string, string>): Promise<GeoPoint | null> {
  const qs = new URLSearchParams({ format: "json", limit: "1", countrycodes: "br", ...params });
  const [hit] = await getJson<{ lat: string; lon: string }[]>(`https://nominatim.openstreetmap.org/search?${qs}`);
  return hit ? toPoint(hit.lat, hit.lon) : null;
}

// Photon (Komoot) usa os mesmos dados do OSM, mas com busca tolerante a erros de
// digitação. Só aceita resultado no Brasil e na mesma cidade do endereço.
async function photon(q: string, city: string): Promise<GeoPoint | null> {
  const qs = new URLSearchParams({ q, limit: "5", lat: "-23.5", lon: "-46.6" });
  const { features } = await getJson<{
    features: { geometry: { coordinates: [number, number] }; properties: { countrycode?: string; city?: string } }[];
  }>(`https://photon.komoot.io/api/?${qs}`);
  const hit = features.find((f) => f.properties.countrycode === "BR" && fold(f.properties.city ?? "") === fold(city));
  return hit ? toPoint(hit.geometry.coordinates[1], hit.geometry.coordinates[0]) : null;
}

// Coordenada do CEP (base dos Correios georreferenciada). Cobre ruas que faltam
// ou estão com nome errado no OSM (ex.: CEP 12283-870).
async function awesomeCep(cep: string): Promise<GeoPoint | null> {
  const d = await getJson<{ lat?: string; lng?: string }>(`https://cep.awesomeapi.com.br/json/${digits(cep)}`);
  return toPoint(d.lat, d.lng);
}

const geoCache = new Map<string, GeoPoint | null>();
const NOT_FOUND = "Não encontramos este endereço no mapa. Confira a rua e o número.";

// Do mais preciso (rua + número) ao menos preciso (CEP, bairro).
export async function geocode(a: Address): Promise<GeoPoint> {
  const key = [a.cep, a.street, a.number, a.city, a.state].join("|").toLowerCase();
  if (geoCache.has(key)) {
    const hit = geoCache.get(key);
    if (hit) return hit;
    throw new GeoError(NOT_FOUND);
  }
  const full = `${a.street}, ${a.number}, ${a.city}, ${a.state}`;
  const { value, allFailed } = await firstOf<GeoPoint>([
    { name: "Nominatim rua+número", run: () => nominatim({ street: `${a.number} ${a.street}`, city: a.city, state: a.state }) },
    { name: "Photon rua+número", run: () => photon(full, a.city) },
    { name: "Nominatim rua", run: () => nominatim({ street: a.street, city: a.city, state: a.state }) },
    { name: "AwesomeAPI CEP", run: () => awesomeCep(a.cep) },
    { name: "Nominatim CEP", run: () => nominatim({ postalcode: digits(a.cep).replace(/(\d{5})(\d{3})/, "$1-$2") }) },
    { name: "Nominatim bairro", run: () => nominatim({ q: `${a.district}, ${a.city}, ${a.state}` }) },
    { name: "Photon bairro", run: () => photon(`${a.district}, ${a.city}`, a.city) },
  ]);
  if (allFailed) throw new GeoError("Serviço de mapas indisponível no momento. Tente novamente.");
  // só guarda "não encontrado" quando houve resposta; falha de rede pode ser passageira
  geoCache.set(key, value);
  if (!value) throw new GeoError(NOT_FOUND);
  return value;
}

// ---------- rota ----------

function haversineKm(a: GeoPoint, b: GeoPoint) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

type Route = { distanceKm: number; durationMin: number };

async function osrm(baseUrl: string, from: GeoPoint, to: GeoPoint): Promise<Route | null> {
  const { routes } = await getJson<{ routes?: { distance: number; duration: number }[] }>(
    `${baseUrl}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`,
  );
  return routes?.[0] ? { distanceKm: routes[0].distance / 1000, durationMin: routes[0].duration / 60 } : null;
}

// Distância/tempo pelas ruas; se os dois OSRM falharem, estima pela linha reta.
export async function route(from: GeoPoint, to: GeoPoint): Promise<Route> {
  const { value } = await firstOf<Route>([
    { name: "OSRM project-osrm", run: () => osrm("https://router.project-osrm.org/route/v1/driving", from, to) },
    { name: "OSRM FOSSGIS", run: () => osrm("https://routing.openstreetmap.de/routed-car/route/v1/driving", from, to) },
  ]);
  if (value) return value;
  const distanceKm = haversineKm(from, to) * 1.35;
  return { distanceKm, durationMin: (distanceKm / 25) * 60 };
}
