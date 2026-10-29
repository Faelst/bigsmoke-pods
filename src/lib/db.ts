import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { SEED_PRODUCTS } from "./products";
import { UBER_PRESETS } from "./delivery-pricing";
import type { Admin, DeliverySettings, Order, Product, StoredCustomer } from "./types";

// Banco de dados simples em arquivo JSON (data/db.json).
// Troque por Postgres/Prisma etc. quando for para produção.
type Session = { token: string; userId: string; createdAt: string };
export type Schema = {
  customers: StoredCustomer[];
  sessions: Session[];
  orders: Order[];
  products: Product[];
  admins: Admin[];
  adminSessions: Session[];
  delivery: DeliverySettings;
};

export const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "db.json");

function seedProducts(): Product[] {
  const now = new Date().toISOString();
  return SEED_PRODUCTS.map((p) => ({ ...p, id: randomUUID(), active: true, createdAt: now }));
}

async function read(): Promise<Schema> {
  let raw: Partial<Schema> = {};
  try {
    raw = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {}
  return {
    customers: raw.customers ?? [],
    sessions: raw.sessions ?? [],
    orders: raw.orders ?? [],
    products: raw.products ?? seedProducts(),
    admins: raw.admins ?? [],
    adminSessions: raw.adminSessions ?? [],
    delivery: raw.delivery ?? { store: null, pricing: { ...UBER_PRESETS.moto.pricing } },
  };
}

// Serializa as escritas para evitar condições de corrida entre requisições.
let queue: Promise<unknown> = Promise.resolve();

export function transaction<T>(fn: (db: Schema) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await read();
    const result = await fn(db);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(db, null, 2));
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function query<T>(fn: (db: Schema) => T): Promise<T> {
  await queue;
  return fn(await read());
}
