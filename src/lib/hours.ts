import type { DayHours, StoreStatus } from "./types";

export const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const ALWAYS_OPEN: DayHours[] = WEEKDAYS.map(() => ({ open: true, start: "00:00", end: "00:00" }));

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Data/hora em Brasília (o servidor na Vercel roda em UTC).
function local(date: Date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { weekday: WEEKDAY_INDEX[p.weekday], time: `${p.hour}:${p.minute}`, ymd: `${p.year}-${p.month}-${p.day}` };
}

export const nowInStore = (date = new Date()) => local(date).time;

// Próximo início de expediente depois de `date` (null se nenhum dia abre).
export function nextOpening(hours: DayHours[], date = new Date()) {
  const { weekday, time, ymd } = local(date);
  const t = toMinutes(time);
  for (let k = 0; k <= 7; k++) {
    const h = hours[(weekday + k) % 7];
    if (!h.open || (k === 0 && toMinutes(h.start) <= t)) continue;
    // Brasília não tem horário de verão desde 2019: offset fixo -03:00.
    return new Date(Date.parse(`${ymd}T${h.start}:00-03:00`) + k * 86_400_000).toISOString();
  }
  return null;
}

export function storeStatus(hours: DayHours[], date = new Date(), closedUntil?: string | null): StoreStatus {
  if (closedUntil && date < new Date(closedUntil)) return { open: false, opensAt: closedUntil, manual: true };
  const { weekday, time } = local(date);
  const t = toMinutes(time);
  const today = hours[weekday];
  const yesterday = hours[(weekday + 6) % 7];
  const [ts, te] = [toMinutes(today.start), toMinutes(today.end)];
  const open =
    (today.open && (ts === te || (t >= ts && (te < ts || t < te)))) ||
    (yesterday.open && toMinutes(yesterday.end) < toMinutes(yesterday.start) && t < toMinutes(yesterday.end));
  return { open, opensAt: open ? null : nextOpening(hours, date) };
}

// "hoje às 10:00", "amanhã às 10:00", "sexta às 10:00".
export function formatOpening(opensAt: string, now = new Date()) {
  const a = local(new Date(opensAt));
  const b = local(now);
  const days = Math.round((Date.parse(a.ymd) - Date.parse(b.ymd)) / 86_400_000);
  const day = days === 0 ? "hoje" : days === 1 ? "amanhã" : WEEKDAYS[a.weekday];
  return `${day} às ${a.time}`;
}

export function parseHours(body: unknown) {
  const list = Array.isArray(body) ? body : [];
  const errors: Record<string, string> = {};
  const data: DayHours[] = WEEKDAYS.map((_, i) => {
    const b = (list[i] ?? {}) as Record<string, unknown>;
    const h = { open: b.open === true, start: String(b.start ?? ""), end: String(b.end ?? "") };
    if (!TIME_RE.test(h.start) || !TIME_RE.test(h.end)) errors[`day${i}`] = "Horário inválido";
    return h;
  });
  return { data, errors, ok: Object.keys(errors).length === 0 };
}
