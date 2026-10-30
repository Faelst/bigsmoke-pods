import { onlyDigits } from "./format";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Input = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "").trim();

export function parseRegister(body: unknown) {
  const b = (body ?? {}) as Input;
  const data = {
    name: str(b.name).slice(0, 80),
    email: str(b.email).toLowerCase().slice(0, 120),
    phone: onlyDigits(str(b.phone)),
    instagram: str(b.instagram).replace(/^@+/, "").slice(0, 30),
    password: String(b.password ?? ""),
  };
  const errors: Record<string, string> = {};
  if (data.name.length < 2) errors.name = "Informe seu nome";
  if (!EMAIL_RE.test(data.email)) errors.email = "E-mail inválido";
  if (data.phone.length < 10 || data.phone.length > 11) errors.phone = "Telefone inválido";
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(data.instagram)) errors.instagram = "Instagram inválido";
  if (data.password.length < 6) errors.password = "A senha precisa ter pelo menos 6 caracteres";
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

export function parseLogin(body: unknown) {
  const b = (body ?? {}) as Input;
  const data = { email: str(b.email).toLowerCase(), password: String(b.password ?? "") };
  const errors: Record<string, string> = {};
  if (!EMAIL_RE.test(data.email)) errors.email = "E-mail inválido";
  if (!data.password) errors.password = "Informe sua senha";
  return { data, errors, ok: Object.keys(errors).length === 0 };
}

// CPF com os dois dígitos verificadores (sem sequências repetidas como 111.111.111-11).
export function isCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    return ((sum * 10) % 11) % 10;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}
