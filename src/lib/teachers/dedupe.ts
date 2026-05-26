import type { Teacher } from "@/lib/types/db";

export function teacherNameKey(t: { first_name: string; last_name: string }): string {
  return `${(t.first_name ?? "").trim()} ${(t.last_name ?? "").trim()}`.replace(/\s+/g, " ").toLowerCase();
}

function pickCanonicalTeacher(list: Teacher[]): Teacher {
  return [...list].sort((a, b) => {
    if (a.email && !b.email) return -1;
    if (b.email && !a.email) return 1;
    if (a.tz && !b.tz) return -1;
    if (b.tz && !a.tz) return 1;
    return a.id.localeCompare(b.id);
  })[0];
}

/** מורה אחת לכל שם — כמו בטבלת מורות. */
export function dedupeTeachersByName(teachers: Teacher[]): Teacher[] {
  const byKey = new Map<string, Teacher[]>();
  const noName: Teacher[] = [];

  for (const t of teachers) {
    const key = teacherNameKey(t);
    if (!key.replace(/\s/g, "")) {
      noName.push(t);
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push(t);
    byKey.set(key, list);
  }

  return [...noName, ...[...byKey.values()].map(pickCanonicalTeacher)];
}

/** כל מזהי המורות עם אותו שם (כפילויות ישנות). */
export function teacherIdsWithSameName(allTeachers: Teacher[], teacherId: string): string[] {
  const selected = allTeachers.find((t) => t.id === teacherId);
  if (!selected) return [teacherId];
  const key = teacherNameKey(selected);
  if (!key.replace(/\s/g, "")) return [teacherId];
  const ids = allTeachers.filter((t) => teacherNameKey(t) === key).map((t) => t.id);
  return ids.length ? ids : [teacherId];
}
