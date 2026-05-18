import { cohortDisplayNumber, gradeForCohort, gradeInPair } from "@/lib/cohorts/grades";
import type { CohortPairView, CohortRow, GradeLevel } from "@/lib/cohorts/types";

export type { GradeLevel };

export function formatCohortGradeLabel(grade: GradeLevel | null | undefined): string {
  return grade ?? "—";
}

export type StudentCohortRef = {
  cohort_id: string;
  cohorts?: Pick<CohortRow, "id" | "name" | "number" | "display_order"> | null;
};

export function enrichStudentsWithGrade<T extends StudentCohortRef>(
  students: T[],
  pair: CohortPairView | null,
): (T & { grade_level: GradeLevel | null; cohort_name: string | null })[] {
  return students.map((s) => {
    const fromCohort = s.cohorts ? gradeForCohort(s.cohorts as CohortRow) : null;
    const fromPair = pair ? gradeInPair(s.cohort_id, pair) : null;
    return {
      ...s,
      grade_level: fromCohort ?? fromPair,
      cohort_name: s.cohorts ? cohortDisplayNumber(s.cohorts as CohortRow) : null,
    };
  });
}
