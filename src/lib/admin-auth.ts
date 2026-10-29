import "server-only";
import { randomUUID } from "crypto";
import { query, transaction } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { sessionStore } from "./session-cookie";

const session = sessionStore("bsp_admin", "adminSessions");

export type AdminUser = { id: string; name: string; email: string };

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const id = await session.userId();
  if (!id) return null;
  const a = await query((db) => db.admins.find((x) => x.id === id));
  return a ? { id: a.id, name: a.name, email: a.email } : null;
}

// Na primeira execução cria o admin a partir das variáveis ADMIN_EMAIL / ADMIN_PASSWORD (.env.local).
async function ensureSeedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (await query((db) => db.admins.length > 0)) return;
  const passwordHash = await hashPassword(password);
  await transaction((db) => {
    if (db.admins.length === 0)
      db.admins.push({ id: randomUUID(), name: "Administrador", email, passwordHash, createdAt: new Date().toISOString() });
  });
}

export async function adminSignIn(email: string, password: string) {
  await ensureSeedAdmin();
  const a = await query((db) => db.admins.find((x) => x.email === email.trim().toLowerCase()));
  if (!a || !(await verifyPassword(password, a.passwordHash))) return null;
  await session.create(a.id);
  return { id: a.id, name: a.name, email: a.email };
}

export const adminSignOut = () => session.destroy();

const unauthorized = () => Response.json({ error: "Acesso restrito ao administrador" }, { status: 401 });

// Envolve um route handler exigindo sessão de admin.
export function withAdmin<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => ((await getCurrentAdmin()) ? handler(...args) : unauthorized());
}
