import { formatHebrewDateFromDate } from "@/lib/hebrewDate";

/** תאריך יעד לפי תאריך מבחן (YYYY-MM-DD) ± ימים — תצוגה עברית (ג סיוון) */
export function examTrackingDueDate(examDate: string | null | undefined, dayOffset: number): string {
  if (!examDate?.trim()) return "—";
  const base = new Date(`${examDate.trim()}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "—";
  base.setDate(base.getDate() + dayOffset);
  return formatHebrewDateFromDate(base) || "—";
}

/** תאריך+שעה מ־ISO — תצוגה עברית (תאריך עברי + שעה) */
export function formatTrackingDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = formatHebrewDateFromDate(d);
  if (!datePart) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${datePart}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const EXAM_SUBMISSION_DUE_OFFSET = -7;
export const GRADES_SUBMISSION_DUE_OFFSET = 7;
