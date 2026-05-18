import { NextResponse } from "next/server";
import { selectedCohortIdList } from "@/lib/cohorts/server";
import { softDeleteStudentsInCohorts } from "@/lib/scope/bulkDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** מחיקה רכה של תלמידות בזוג המחזורים הנבחר */
export async function POST() {
  const supabase = createSupabaseAdminClient();
  const cohortIds = await selectedCohortIdList(supabase);
  if (!cohortIds.length) {
    return NextResponse.json({ error: "לא נבחר זוג מחזורים" }, { status: 400 });
  }
  try {
    const deleted = await softDeleteStudentsInCohorts(supabase, cohortIds);
    return NextResponse.json({ deleted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
