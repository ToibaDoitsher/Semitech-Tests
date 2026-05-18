import type { CohortPairOption, CohortRow, CohortPairView, GradeLevel } from "@/lib/cohorts/types";

export function cohortDisplayNumber(c: Pick<CohortRow, "name" | "number">): string {
  if (c.number != null) return String(c.number);
  if (c.name?.trim()) return c.name.trim();
  return "";
}

export function cohortWithGradeLabel(c: CohortRow): string {
  const grade = gradeForCohort(c);
  const num = cohortDisplayNumber(c);
  return grade ? `מחזור ${num} (שכבה ${grade})` : `מחזור ${num}`;
}

/** שכבה לפי display_order במסד — לא לפי מספר מחזור */
export function gradeForCohort(cohort: Pick<CohortRow, "display_order">): GradeLevel | null {
  if (cohort.display_order === 1) return "א";
  if (cohort.display_order === 2) return "ב";
  return null;
}

export function buildCohortPairView(cohortA: CohortRow, cohortB: CohortRow): CohortPairView {
  const [high, low] =
    cohortA.number >= cohortB.number ? [cohortA, cohortB] : [cohortB, cohortA];
  const gradeByCohortId = new Map<string, GradeLevel>();
  for (const c of [cohortA, cohortB]) {
    const g = gradeForCohort(c);
    if (g) gradeByCohortId.set(c.id, g);
  }
  return { cohortA: high, cohortB: low, gradeByCohortId };
}

export function gradeInPair(cohortId: string, pair: CohortPairView): GradeLevel | null {
  return pair.gradeByCohortId.get(cohortId) ?? null;
}

export function buildPairOptions(cohorts: CohortRow[]): {
  options: CohortPairOption[];
  defaultPair: { cohortAId: string; cohortBId: string } | null;
} {
  const sorted = [...cohorts].sort((a, b) => b.number - a.number);
  const layerA = sorted.find((c) => c.display_order === 1);
  const layerB = sorted.find((c) => c.display_order === 2);
  const defaultPair =
    layerA && layerB
      ? {
          cohortAId: layerA.number >= layerB.number ? layerA.id : layerB.id,
          cohortBId: layerA.number >= layerB.number ? layerB.id : layerA.id,
        }
      : null;

  const options: CohortPairOption[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const hi = sorted[i];
    const lo = sorted[i + 1];
    if (hi.number - lo.number !== 1) continue;
    options.push({
      cohortAId: hi.id,
      cohortBId: lo.id,
      label: `${hi.number} + ${lo.number}`,
      cohortANumber: hi.number,
      cohortBNumber: lo.number,
      isDefaultPair: Boolean(
        defaultPair &&
          defaultPair.cohortAId === hi.id &&
          defaultPair.cohortBId === lo.id,
      ),
    });
  }
  return { options, defaultPair };
}
