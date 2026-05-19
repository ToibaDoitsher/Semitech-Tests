const DAY_LETTERS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "י״א", "י״ב", "י״ג", "י״ד", "ט״ו", "ט״ז", "י״ז", "י״ח", "י״ט", "כ", "כ״א", "כ״ב", "כ״ג", "כ״ד", "כ״ה", "כ״ו", "כ״ז", "כ״ח", "כ״ט", "ל"];

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
  return `${prefix}${core}`;
}

export type HebrewDateParts = { day: number; month: number; year: number };

function readHebrewParts(d: Date): HebrewDateParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(d);
    const day = Number(parts.find((p) => p.type === "day")?.value ?? 0);
    const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
    const year = Number(parts.find((p) => p.type === "year")?.value ?? 0);
    if (!day || !month || !year) return null;
    return { day, month, year };
  } catch {
    return null;
  }
}

/** תאריך עברי בפורמט מסורתי: ג׳ בשבט תשפ״ו */
export function formatHebrewDateTraditional(d: Date): string {
  try {
    const hp = readHebrewParts(d);
    if (!hp) return "";
    const dayStr = DAY_LETTERS[hp.day] ?? String(hp.day);
    const monthStr = MONTH_NAMES[hp.month] ?? "";
    const yearStr = hebrewYearLetters(hp.year);
    return `${dayStr} ב${monthStr} ${yearStr}`.trim();
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

  const approx = year + 3760;
  const start = new Date(approx - 1, 0, 1);
  const end = new Date(approx + 1, 11, 31);
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const hp = readHebrewParts(d);
    if (hp && hp.day === day && hp.month === month && hp.year === year) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }
  return null;
}

export function todayHebrewParts(): HebrewDateParts {
  return readHebrewParts(new Date()) ?? { day: 1, month: 7, year: 5786 };
}
