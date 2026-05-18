export type AcademicYearRow = {
  id: string;
  year_name: string;
  is_active: boolean;
  created_at?: string;
};

export type GradeLevel = "א" | "ב" | "ג";

export const GRADE_LEVELS: readonly GradeLevel[] = ["א", "ב", "ג"] as const;
