import { formatGradeLabel, formatYearGradeLabel } from "@/lib/academicYears/labels";
import type { GradeLevel } from "@/lib/academicYears/types";

export type { GradeLevel };

export function formatCohortGradeLabel(grade: GradeLevel | null | undefined): string {
  return formatGradeLabel(grade);
}

export { formatYearGradeLabel };

export type StudentYearRef = {
  year_group: number;
  grade_level: GradeLevel;
};

export function enrichStudentsWithGrade<T extends StudentYearRef>(
  students: T[],
): (T & { grade_level: GradeLevel; year_label: string })[] {
  return students.map((s) => ({
    ...s,
    grade_level: s.grade_level,
    year_label: formatYearGradeLabel(s.year_group, s.grade_level),
  }));
}
