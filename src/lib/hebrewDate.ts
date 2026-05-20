const DAY_LETTERS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "י״א", "י״ב", "י״ג", "י״ד", "ט״ו", "ט״ז", "י״ז", "י״ח", "י״ט", "כ", "כ״א", "כ״ב", "כ״ג", "כ״ד", "כ״ה", "כ״ו", "כ״ז", "כ״ח", "כ״ט", "ל"];

export const HEBREW_DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => {
  const value = i + 1;
  return { value, label: DAY_LETTERS[value] ?? String(value) };
});

export function formatHebrewYearLetters(year: number): string {
  return hebrewYearLetters(year);
}

/** אפשרויות שנה עברית (אותיות) סביב שנה נוכחית */
export function hebrewYearOptions(aroundYear?: number): { value: number; label: string }[] {
  const center = aroundYear ?? readHebrewParts(new Date())?.year ?? 5786;
  const out: { value: number; label: string }[] = [];
  for (let y = center - 6; y <= center + 6; y++) {
    if (y < 5770 || y > 5800) continue;
    out.push({ value: y, label: hebrewYearLetters(y) });
  }
  return out;
}

export const HEBREW_MONTH_OPTIONS = [
  { value: 1, label: "ניסן" },
  { value: 2, label: "אייר" },
  { value: 3, label: "סיוון" },
  { value: 4, label: "תמוז" },
  { value: 5, label: "אב" },
  { value: 6, label: "אלול" },
  { value: 7, label: "תשרי" },
  { value: 8, label: "חשוון" },
  { value: 9, label: "כסלו" },
  { value: 10, label: "טבת" },
  { value: 11, label: "שבט" },
  { value: 12, label: "אדר" },
  { value: 13, label: "אדר ב" },
] as const;

const MONTH_NAMES = [
  "",
  ...HEBREW_MONTH_OPTIONS.map((m) => m.label),
];

function hebrewYearLetters(y: number): string {
  const thousands = Math.floor(y / 1000);
  const rest = y % 1000;
  const hundreds = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  let h = rest;
  const hIdx = Math.floor(h / 100);
  h %= 100;
  const tIdx = Math.floor(h / 10);
  const oIdx = h % 10;
  const core = `${hundreds[hIdx] ?? ""}${tens[tIdx] ?? ""}${ones[oIdx] ?? ""}`;
  const prefix = thousands > 5 ? "ה" : "";
  if (core.length > 1) {
    return `${prefix}${core.slice(0, -1)}״${core.slice(-1)}`;
  }
  return `${prefix}${core}`;
}

export type HebrewDateParts = { day: number; month: number; year: number };

const hebrewToGregorianCache = new Map<string, string | null>();
const maxDayInMonthCache = new Map<string, number>();

const HEBREW_MONTH_BY_NAME: Record<string, number> = {
  Nisan: 1,
  Nissan: 1,
  Iyar: 2,
  Iyyar: 2,
  Sivan: 3,
  Tamuz: 4,
  Tammuz: 4,
  Av: 5,
  Elul: 6,
  Tishrei: 7,
  Tishri: 7,
  Cheshvan: 8,
  Heshvan: 8,
  Marcheshvan: 8,
  Kislev: 9,
  Tevet: 10,
  Teves: 10,
  Shevat: 11,
  Shvat: 11,
  Adar: 12,
  "Adar I": 12,
  "Adar II": 13,
  "Adar Ii": 13,
  ניסן: 1,
  אייר: 2,
  סיוון: 3,
  תמוז: 4,
  אב: 5,
  אלול: 6,
  תשרי: 7,
  חשוון: 8,
  כסלו: 9,
  טבת: 10,
  שבט: 11,
  אדר: 12,
  "אדר א": 12,
  "אדר ב": 13,
  "אדר ב׳": 13,
};

function parseHebrewMonth(raw: string): number {
  const key = raw.trim();
  if (!key) return 0;
  const direct = HEBREW_MONTH_BY_NAME[key];
  if (direct) return direct;
  const lower = key.toLowerCase();
  for (const [name, num] of Object.entries(HEBREW_MONTH_BY_NAME)) {
    if (name.toLowerCase() === lower) return num;
  }
  const numeric = Number(key);
  return numeric >= 1 && numeric <= 13 ? numeric : 0;
}

function readHebrewParts(d: Date): HebrewDateParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).formatToParts(d);
    const day = Number(parts.find((p) => p.type === "day")?.value ?? 0);
    const month = parseHebrewMonth(parts.find((p) => p.type === "month")?.value ?? "");
    const year = Number(parts.find((p) => p.type === "year")?.value ?? 0);
    if (!day || !month || !year) return null;
    return { day, month, year };
  } catch {
    return null;
  }
}

/** תאריך עברי בפורמט מסורתי: ג סיוון, כ״ח תשרי */
export function formatHebrewDateTraditional(d: Date): string {
  try {
    const hp = readHebrewParts(d);
    if (!hp) return "";
    const dayStr = DAY_LETTERS[hp.day] ?? String(hp.day);
    const monthStr = MONTH_NAMES[hp.month] ?? "";
    return `${dayStr} ${monthStr}`.trim();
  } catch {
    return "";
  }
}

/** תאריך עברי מלא כולל שנה: ג סיוון תשפ״ו */
export function formatHebrewDateWithYear(d: Date): string {
  try {
    const hp = readHebrewParts(d);
    if (!hp) return "";
    const dayStr = DAY_LETTERS[hp.day] ?? String(hp.day);
    const monthStr = MONTH_NAMES[hp.month] ?? "";
    const yearStr = hebrewYearLetters(hp.year);
    return `${dayStr} ${monthStr} ${yearStr}`.trim();
  } catch {
    return "";
  }
}

export function gregorianYmdToHebrewParts(ymd: string): HebrewDateParts | null {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return readHebrewParts(d);
}

export function hebrewPartsToGregorianYmd(parts: HebrewDateParts): string | null {
  const { day, month, year } = parts;
  if (!day || !month || !year || day < 1 || day > 30 || month < 1 || month > 13) return null;

  const cacheKey = `${year}:${month}:${day}`;
  if (hebrewToGregorianCache.has(cacheKey)) {
    return hebrewToGregorianCache.get(cacheKey)!;
  }

  const approxGreg = year - 3760;
  // Hebrew year ~Tishrei (Sep) of approxGreg-1 through ~Elul (Aug) of approxGreg
  const start = new Date(approxGreg - 1, 8, 1, 12, 0, 0, 0);
  const end = new Date(approxGreg, 10, 28, 12, 0, 0, 0);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    d.setHours(12, 0, 0, 0);
    const hp = readHebrewParts(d);
    if (hp && hp.day === day && hp.month === month && hp.year === year) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      hebrewToGregorianCache.set(cacheKey, ymd);
      return ymd;
    }
  }
  hebrewToGregorianCache.set(cacheKey, null);
  return null;
}

/** מספר הימים בחודש עברי (29/30; אדר ב רק בשנה מעוברת). */
export function maxHebrewDayInMonth(month: number, year: number): number {
  const cacheKey = `${year}:${month}`;
  if (maxDayInMonthCache.has(cacheKey)) {
    return maxDayInMonthCache.get(cacheKey)!;
  }
  let maxDay = 0;
  if (hebrewPartsToGregorianYmd({ day: 30, month, year })) {
    maxDay = 30;
  } else if (hebrewPartsToGregorianYmd({ day: 29, month, year })) {
    maxDay = 29;
  }
  maxDayInMonthCache.set(cacheKey, maxDay);
  return maxDay;
}

/** חודשים תקפים לשנה עברית (בלי «אדר ב» בשנה שאינה מעוברת). */
export function hebrewMonthsForYear(year: number) {
  return HEBREW_MONTH_OPTIONS.filter((m) => maxHebrewDayInMonth(m.value, year) > 0);
}

export function clampHebrewParts(parts: HebrewDateParts): HebrewDateParts {
  const months = hebrewMonthsForYear(parts.year);
  let month = parts.month;
  if (!months.some((m) => m.value === month)) {
    month = months[months.length - 1]?.value ?? month;
  }
  const maxDay = maxHebrewDayInMonth(month, parts.year);
  const day = maxDay ? Math.min(Math.max(1, parts.day), maxDay) : parts.day;
  return { day, month, year: parts.year };
}

/** תצוגה עברית מתאריך גregoriani YYYY-MM-DD (שמור במסד). */
export function formatHebrewDateFromYmd(ymd: string): string {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return ymd;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return ymd;
  return formatHebrewDateTraditional(d) || ymd;
}

export function todayHebrewParts(): HebrewDateParts {
  return readHebrewParts(new Date()) ?? { day: 1, month: 7, year: 5786 };
}

if (typeof window !== "undefined") {
  queueMicrotask(() => {
    const today = todayHebrewParts();
    clampHebrewParts(today);
    hebrewPartsToGregorianYmd(today);
    hebrewMonthsForYear(today.year);
  });
}

const hebrewDisplayCache = new Map<number, string>();

/** תאריך עברי מ־Date — עם cache ליומן / תצוגות חוזרות */
export function formatHebrewDateFromDate(d: Date): string {
  const key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const cached = hebrewDisplayCache.get(key);
  if (cached !== undefined) return cached;
  const s = formatHebrewDateTraditional(d);
  hebrewDisplayCache.set(key, s);
  return s;
}
