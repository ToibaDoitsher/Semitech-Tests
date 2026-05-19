import type { EventInput } from "@fullcalendar/core";
import type { CalendarExamProps } from "@/lib/calendar/types";
import { formatHebrewDateTraditional } from "@/lib/hebrewDate";

export function eventStartYmd(ev: EventInput): string {
  const s = ev.start;
  if (!s) return "";
  if (s instanceof Date) {
    const y = s.getFullYear();
    const m = String(s.getMonth() + 1).padStart(2, "0");
    const day = String(s.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (typeof s === "string") return s.length >= 10 ? s.slice(0, 10) : s;
  return "";
}

export function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  return new Date(y, mo - 1, day);
}

export function formatGregorianDateLong(ymd: string): string {
  const d = parseLocalYmd(ymd);
  if (!d) return ymd;
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatHebrewDateFromYmd(ymd: string): string {
  const d = parseLocalYmd(ymd);
  if (!d) return "";
  return formatHebrewDateTraditional(d);
}

export type ScheduleDayGroup = {
  date: string;
  gregorianLabel: string;
  hebrewLabel: string;
  exams: CalendarExamProps[];
};

export function groupExamsByDate(events: EventInput[]): ScheduleDayGroup[] {
  const byDate = new Map<string, CalendarExamProps[]>();
  for (const ev of events) {
    const ymd = eventStartYmd(ev);
    const xp = ev.extendedProps as unknown as CalendarExamProps;
    if (!ymd || !xp?.subject) continue;
    const list = byDate.get(ymd) ?? [];
    list.push(xp);
    byDate.set(ymd, list);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, exams]) => ({
      date,
      gregorianLabel: formatGregorianDateLong(date),
      hebrewLabel: formatHebrewDateFromYmd(date),
      exams: exams.sort((a, b) => {
        const sub = a.subject.localeCompare(b.subject, "he");
        if (sub !== 0) return sub;
        return (a.teacherName ?? "").localeCompare(b.teacherName ?? "", "he");
      }),
    }));
}

export type ActiveFilters = {
  teacher?: string;
  subject?: string;
  grade?: string;
  classTarget?: string;
  spec?: string;
  track?: string;
};

export function buildFilterSummary(filters: ActiveFilters): string {
  const parts: string[] = [];
  if (filters.subject) parts.push(`מקצוע: ${filters.subject}`);
  if (filters.grade) parts.push(`שכבה: ${filters.grade}`);
  if (filters.classTarget) parts.push(`כיתה: ${filters.classTarget}`);
  if (filters.spec) parts.push(`התמחות: ${filters.spec}`);
  if (filters.track) parts.push(`מסלול: ${filters.track}`);
  if (filters.teacher) parts.push(`מורה: ${filters.teacher}`);
  return parts.length ? parts.join(" · ") : "כל המבחנים בתקופה המוצגת ביומן";
}
