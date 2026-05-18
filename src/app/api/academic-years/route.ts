import { NextResponse } from "next/server";
import { loadActiveCohortPair } from "@/lib/cohorts/active";
import { cohortDisplayNumber } from "@/lib/cohorts/grades";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** @deprecated Use /api/cohorts/pair */
export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = createSupabaseAdminClient();
    const pair = await loadActiveCohortPair(supabase);
    return NextResponse.json({
      years: [],
      current: pair
        ? {
            cohort_a_name: cohortDisplayNumber(pair.cohortA),
            cohort_b_name: cohortDisplayNumber(pair.cohortB),
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, years: [] }, { status: 500 });
  }
}

export async function POST() {
  await requireCurrentUser();
  return NextResponse.json(
    { error: "לפתיחת מחזור חדש השתמשי במסך «פתיחת שנתון»" },
    { status: 400 },
  );
}
