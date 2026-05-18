export type GradeLevel = "א" | "ב";

export type CohortRow = {
  id: string;
  name?: string | null;
  number: number;
  display_order: number | null;
};

export type CohortPairView = {
  cohortA: CohortRow;
  cohortB: CohortRow;
  gradeByCohortId: Map<string, GradeLevel>;
};

export type CohortPairOption = {
  cohortAId: string;
  cohortBId: string;
  label: string;
  cohortANumber: number;
  cohortBNumber: number;
  isDefaultPair: boolean;
};
