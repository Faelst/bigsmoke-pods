import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { assertWritableHost, DATA_DIR, pool, usingPostgres } from "./db";

// Imagens enviadas pelo admin: tabela "uploads" no Postgres ou data/uploads localmente.
const DIR = path.join(DATA_DIR, "uploads");

export async function saveUpload(name: string, type: string, data: Buffer) {
  if (usingPostgres) {
    const { pool: p, ready } = pool();
    await ready;
    await p.query("INSERT INTO uploads (name, type, data) VALUES ($1, $2, $3)", [name, type, data]);
    return;
  }
  assertWritableHost();
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, name), data);
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (usingPostgres) {
    const { pool: p, ready } = pool();
    await ready;
    const { rows } = await p.query("SELECT data FROM uploads WHERE name = $1", [name]);
    return rows[0]?.data ?? null;
  }
  return fs.readFile(path.join(DIR, name)).catch(() => null);
}
