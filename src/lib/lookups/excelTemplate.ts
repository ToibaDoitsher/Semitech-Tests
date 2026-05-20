import type { LookupEntitySlug } from "@/lib/lookups/entities";

export const LOOKUP_EXCEL_HEADER = "שם";

export const LOOKUP_EXCEL_EXAMPLES: Record<LookupEntitySlug, string[]> = {
  classes: ["יא3", "יב1", "יג2"],
  specializations: ["גרפיקה", "תכנות", "חשבונאות"],
  tracks: ["הוראה", "הוראה קצרה", "ללא הוראה"],
  "grade-level-options": ["א", "ב", "ג", "א+ב"],
};
