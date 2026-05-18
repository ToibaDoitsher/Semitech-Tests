import type { GradeLevel } from "@/lib/academicYears/types";
import type { LookupRow, StudentStatus } from "@/lib/types/db";

export type StudentWithLookupsRow = {
  id: string;
  academic_year_id: string;
  first_name: string;
  last_name: string;
  tz: string;
  year_group: number;
  grade_level: GradeLevel;
  class_id: string;
  specialization_id: string | null;
  secondary_specialization_id?: string | null;
  track_id: string | null;
  is_psychology?: boolean;
  teaching_track_type?: "full" | "short" | null;
  notes?: string | null;
  status?: StudentStatus;
  created_at?: string;
  classes?: LookupRow | null;
  specializations?: LookupRow | null;
  secondary_specializations?: LookupRow | null;
  tracks?: LookupRow | null;
  year_label?: string | null;
};

export function asStudentRows(data: unknown): StudentWithLookupsRow[] {
  return (data ?? []) as StudentWithLookupsRow[];
}

export function asStudentRow(data: unknown): StudentWithLookupsRow {
  return data as StudentWithLookupsRow;
}
