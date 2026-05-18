export const LOOKUP_ENTITIES = ["classes", "specializations", "tracks", "grade-level-options"] as const;
export type LookupEntitySlug = (typeof LOOKUP_ENTITIES)[number];

export const ENTITY_TO_TABLE: Record<LookupEntitySlug, string> = {
  classes: "classes",
  specializations: "specializations",
  tracks: "tracks",
  "grade-level-options": "grade_level_options",
};

export const ENTITY_LABELS: Record<LookupEntitySlug, string> = {
  classes: "כיתות",
  specializations: "התמחויות",
  tracks: "מסלולים",
  "grade-level-options": "שכבות",
};

export function isLookupEntity(s: string): s is LookupEntitySlug {
  return (LOOKUP_ENTITIES as readonly string[]).includes(s);
}
