import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAssignmentTargetLabels,
  type AssignmentTargetRow,
} from "@/lib/assignments/target";

/** @deprecated Use resolveAssignmentTargetLabels — kept for call-site compatibility */
export async function resolveExamTargetLabels(
  supabase: SupabaseClient,
  rows: AssignmentTargetRow[],
): Promise<Record<string, string>> {
  return resolveAssignmentTargetLabels(supabase, rows);
}
