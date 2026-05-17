import type { GradeLevel } from "@/lib/students/gradeLevel";
import type { LookupRow, StudentStatus } from "@/lib/types/db";

export type StudentWithLookupsRow = {
  id: string;
  first_name: string;
  last_name: string;
  tz: string;
  cohort_number: number;
  grade_level: GradeLevel;
  academic_year_id: string;
  class_id: string;
  specialization_id: string | null;
  track_id: string | null;
  notes?: string | null;
  status?: StudentStatus;
  created_at?: string;
  classes?: LookupRow | null;
  specializations?: LookupRow | null;
  tracks?: LookupRow | null;
};

export function asStudentRows(data: unknown): StudentWithLookupsRow[] {
  return (data ?? []) as StudentWithLookupsRow[];
}

export function asStudentRow(data: unknown): StudentWithLookupsRow {
  return data as StudentWithLookupsRow;
}
