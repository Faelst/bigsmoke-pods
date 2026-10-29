import { onlyDigits } from "./format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

export function luhn(num: string) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return num.length >= 13 && sum % 10 === 0;
}

export function cardBrand(num: string) {
  if (/^4/.test(num)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(num)) return "Mastercard";
  if (/^3[47]/.test(num)) return "Amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(num)) return "Elo";
  if (/^(606282|3841)/.test(num)) return "Hipercard";
  return "Cartão";
}
