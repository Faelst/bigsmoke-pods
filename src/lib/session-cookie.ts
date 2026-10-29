import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { query, transaction, type Schema } from "./db";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

// Sessões opacas (token aleatório no cookie httpOnly, guardado no banco).
// Reaproveitado pela loja (clientes) e pelo admin, cada um com seu cookie e tabela.
export function sessionStore(cookie: string, table: "sessions" | "adminSessions") {
  return {
    async userId() {
      const token = (await cookies()).get(cookie)?.value;
      if (!token) return null;
      return query((db) => db[table].find((s) => s.token === token)?.userId ?? null);
    },
    async create(userId: string) {
      const token = randomBytes(32).toString("hex");
      await transaction((db) => void db[table].push({ token, userId, createdAt: new Date().toISOString() }));
      (await cookies()).set(cookie, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MAX_AGE,
      });
    },
    async destroy() {
      const store = await cookies();
      const token = store.get(cookie)?.value;
      if (token) await transaction((db: Schema) => void (db[table] = db[table].filter((s) => s.token !== token)));
      store.delete(cookie);
    },
  };
}
