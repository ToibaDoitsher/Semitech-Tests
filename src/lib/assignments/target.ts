import type { AssignmentCategory } from "@/lib/types/db";

export function parseAssignmentCategory(raw: string): AssignmentCategory | null {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return null;
  if (t === "חובה" || t === "mandatory" || t === "חובה כללית") return "חובה";
  if (t === "התמחות" || t === "specialization" || t === "התמחות מקצועית") return "התמחות";
  return null;
}
