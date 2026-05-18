import type { GradeLevel } from "@/lib/academicYears/types";

export function formatYearGradeLabel(yearGroup: number, gradeLevel: GradeLevel): string {
  return `שנתון ${yearGroup} — שכבה ${gradeLevel}`;
}

export function formatGradeLabel(gradeLevel: GradeLevel | null | undefined): string {
  return gradeLevel ? `שכבה ${gradeLevel}` : "—";
}

export function parseGradeLevel(raw: string): GradeLevel | null {
  const t = raw.trim();
  if (t === "א" || t === "ב" || t === "ג") return t;
  if (t === "A" || t === "a") return "א";
  if (t === "B" || t === "b") return "ב";
  if (t === "C" || t === "c" || t === "G" || t === "g") return "ג";
  return null;
}

export function parseYearGroup(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
