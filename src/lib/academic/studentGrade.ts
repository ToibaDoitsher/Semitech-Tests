import { cohortDisplayNumber, gradeInPair } from "@/lib/cohorts/grades";
import type { CohortPairView, CohortRow, GradeLevel } from "@/lib/cohorts/types";

export type { GradeLevel };

export function formatCohortGradeLabel(grade: GradeLevel | null | undefined): string {
  return grade ?? "—";
}

export type StudentCohortRef = {
  cohort_id: string;
  cohorts?: Pick<CohortRow, "id" | "name" | "number"> | null;
};

export function enrichStudentsWithGrade<T extends StudentCohortRef>(
  students: T[],
  pair: CohortPairView | null,
): (T & { grade_level: GradeLevel | null; cohort_name: string | null })[] {
  return students.map((s) => ({
    ...s,
    grade_level: pair ? gradeInPair(s.cohort_id, pair) : null,
    cohort_name: s.cohorts ? cohortDisplayNumber(s.cohorts as CohortRow) : null,
  }));
}
