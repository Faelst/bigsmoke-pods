import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Pool, type PoolClient } from "pg";
import { SEED_PRODUCTS } from "./products";
import { UBER_PRESETS } from "./delivery-pricing";
import { ALWAYS_OPEN } from "./hours";
import { DEFAULT_SOCIAL } from "./site";
import { DEFAULT_PAYMENT_FEES } from "./payment-fees";
import type { Admin, DeliverySettings, Order, PaymentFees, Product, StoreSettings, StoredCustomer } from "./types";

// Banco de dados como um documento JSON:
// - com DATABASE_URL (ex.: Neon na Vercel): uma linha jsonb no Postgres, com lock por transação;
// - sem DATABASE_URL (desenvolvimento local): arquivo data/db.json.
type Session = { token: string; userId: string; createdAt: string };
export type Schema = {
  customers: StoredCustomer[];
  sessions: Session[];
  orders: Order[];
  products: Product[];
  admins: Admin[];
  adminSessions: Session[];
  delivery: DeliverySettings;
  settings: StoreSettings;
  paymentFees: PaymentFees;
};

export const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "db.json");
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;


function seedProducts(): Product[] {
  const now = new Date().toISOString();
  return SEED_PRODUCTS.map((p) => ({ ...p, id: randomUUID(), active: true, createdAt: now }));
}

// Sabores eram só nomes; viram { nome, estoque } com estoque zerado até o admin informar.
function migrateFlavors(p: Product): Product {
  const flavors = p.flavors as (Product["flavors"][number] | string)[];
  return { ...p, flavors: flavors.map((f) => (typeof f === "string" ? { name: f, stock: 0 } : f)) };
}

// Selos antigos em texto viraram marcações próprias.
function migrateBadge(p: Product): Product {
  if (p.badge === "Mais vendido") return { ...p, badge: undefined, bestseller: true };
  if (p.badge === "Novo" || p.badge === "Novidade") return { ...p, badge: undefined, isNew: true };
  return p;
}

function normalize(raw: Partial<Schema>): Schema {
  return {
    customers: raw.customers ?? [],
    sessions: raw.sessions ?? [],
    orders: raw.orders ?? [],
    products: (raw.products ?? seedProducts()).map(migrateBadge).map(migrateFlavors),
    admins: raw.admins ?? [],
    adminSessions: raw.adminSessions ?? [],
    delivery: raw.delivery ?? { store: null, pricing: { ...UBER_PRESETS.moto.pricing } },
    settings: { ...raw.settings, hours: raw.settings?.hours ?? ALWAYS_OPEN, social: { ...DEFAULT_SOCIAL, ...raw.settings?.social } },
    paymentFees: raw.paymentFees ?? DEFAULT_PAYMENT_FEES,
  };
}

// ---- Postgres ----

const g = globalThis as unknown as { __bspPool?: Pool; __bspSchema?: Promise<void> };

export function pool() {
  g.__bspPool ??= new Pool({
    connectionString: DATABASE_URL,
    max: 3,
    ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL ?? "") ? undefined : { rejectUnauthorized: false },
  });
  g.__bspSchema ??= g.__bspPool
    .query(
      `CREATE TABLE IF NOT EXISTS app_state (id int PRIMARY KEY, doc jsonb NOT NULL);
       CREATE TABLE IF NOT EXISTS uploads (name text PRIMARY KEY, type text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
       INSERT INTO app_state (id, doc) VALUES (1, '{}') ON CONFLICT (id) DO NOTHING;`,
    )
    .then(() => undefined)
    .catch((e) => {
      g.__bspSchema = undefined;
      throw e;
    });
  return { pool: g.__bspPool, ready: g.__bspSchema };
}

async function pgTransaction<T>(fn: (db: Schema) => T | Promise<T>): Promise<T> {
  const { pool: p, ready } = pool();
  await ready;
  const client: PoolClient = await p.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT doc FROM app_state WHERE id = 1 FOR UPDATE");
    const db = normalize(rows[0]?.doc ?? {});
    const result = await fn(db);
    await client.query("UPDATE app_state SET doc = $1 WHERE id = 1", [JSON.stringify(db)]);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function pgRead(): Promise<Schema> {
  const { pool: p, ready } = pool();
  await ready;
  const { rows } = await p.query("SELECT doc FROM app_state WHERE id = 1");
  return normalize(rows[0]?.doc ?? {});
}

// ---- Arquivo local ----

function assertWritableHost() {
  if (process.env.VERCEL)
    throw new Error("Configure DATABASE_URL (Postgres) — a Vercel não permite gravar arquivos. Veja o README.");
}

async function fileRead(): Promise<Schema> {
  assertWritableHost();
  let raw: Partial<Schema> = {};
  try {
    raw = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {}
  return normalize(raw);
}

async function fileTransaction<T>(fn: (db: Schema) => T | Promise<T>): Promise<T> {
  const db = await fileRead();
  const result = await fn(db);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
  return result;
}

export const usingPostgres = !!DATABASE_URL;
export { assertWritableHost };

// Serializa as escritas deste processo; no Postgres o FOR UPDATE protege entre instâncias.
let queue: Promise<unknown> = Promise.resolve();

export function transaction<T>(fn: (db: Schema) => T | Promise<T>): Promise<T> {
  const run = queue.then(() => (usingPostgres ? pgTransaction(fn) : fileTransaction(fn)));
  queue = run.catch(() => undefined);
  return run;
}

export async function query<T>(fn: (db: Schema) => T): Promise<T> {
  await queue;
  return fn(await (usingPostgres ? pgRead() : fileRead()));
}
