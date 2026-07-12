export type AcademicYearRow = {
  id: string;
  year_name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  /** מחצית פעילה/ברירת מחדל לשנה: א או ב */
  active_term?: Term;
  created_at?: string;
};

/** מחצית בתוך שנת לימודים */
export type Term = "א" | "ב";

export const TERMS: readonly Term[] = ["א", "ב"] as const;

export function parseTerm(raw: string | null | undefined): Term | null {
  const v = (raw ?? "").trim();
  if (v === "א" || v === "ב") return v;
  return null;
}

export function defaultTermForYear(year: Pick<AcademicYearRow, "active_term" | "is_active"> | null | undefined): Term {
  const t = parseTerm(year?.active_term ?? null);
  if (t) return t;
  // לפני מיגרציה / בלי עמודה — שנה פעילה נחשבת מחצית ב (נתונים קיימים)
  if (year?.is_active) return "ב";
  return "א";
}

export type GradeLevel = "א" | "ב" | "ג";

export const GRADE_LEVELS: readonly GradeLevel[] = ["א", "ב", "ג"] as const;
