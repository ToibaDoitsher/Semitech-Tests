/** @deprecated Use @/lib/cohorts/active and @/lib/cohorts/server */
export type { GradeLevel, CohortRow, CohortPairView } from "@/lib/cohorts/types";
export { cohortLabel, loadActiveCohortPair as loadYearCohortConfig } from "@/lib/cohorts/active";
export { gradeInPair as gradeForCohortInYear } from "@/lib/cohorts/grades";
export { resolveImportTarget } from "@/lib/cohorts/import";
