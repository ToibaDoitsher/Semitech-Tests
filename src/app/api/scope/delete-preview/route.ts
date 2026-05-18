import { NextResponse } from "next/server";
import { previewScopedDeletes } from "@/lib/scope/bulkDelete";
import { selectedCohortIdList } from "@/lib/cohorts/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const cohortIds = await selectedCohortIdList(supabase);
  const preview = await previewScopedDeletes(supabase, cohortIds);
  return NextResponse.json({ cohortIds, preview });
}
