import { enrichStudentsWithGrade, type StudentYearRef } from "@/lib/academic/studentGrade";

export async function enrichStudentsWithGradeForYear<T extends StudentYearRef>(
  _supabase: unknown,
  students: T[],
): Promise<(T & { grade_level: T["grade_level"]; year_label: string })[]> {
  return enrichStudentsWithGrade(students);
}
