import "server-only";
import { randomUUID } from "crypto";
import { query, transaction } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { sessionStore } from "./session-cookie";
import type { Customer, StoredCustomer } from "./types";

const session = sessionStore("bsp_session", "sessions");

export function toPublic(stored: StoredCustomer): Customer {
  const { passwordHash, ...customer } = stored;
  void passwordHash;
  return customer;
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  const id = await session.userId();
  if (!id) return null;
  const c = await query((db) => db.customers.find((x) => x.id === id));
  return c ? toPublic(c) : null;
}

export class AuthError extends Error {
  constructor(public errors: Record<string, string>) {
    super("auth");
  }
}

export async function register(data: Omit<Customer, "id" | "createdAt"> & { password: string }) {
  const { password, ...profile } = data;
  const passwordHash = await hashPassword(password);
  const customer = await transaction((db) => {
    if (db.customers.some((c) => c.email === profile.email))
      throw new AuthError({ email: "Este e-mail já tem cadastro. Faça login." });
    const c: StoredCustomer = { id: randomUUID(), ...profile, passwordHash, createdAt: new Date().toISOString() };
    db.customers.push(c);
    return c;
  });
  await session.create(customer.id);
  return toPublic(customer);
}

export async function signIn(email: string, password: string) {
  const c = await query((db) => db.customers.find((x) => x.email === email));
  if (!c || !(await verifyPassword(password, c.passwordHash)))
    throw new AuthError({ password: "E-mail ou senha incorretos" });
  await session.create(c.id);
  return toPublic(c);
}

export const signOut = () => session.destroy();
