import { NextResponse } from "next/server";
import { loadYearCohortConfig } from "@/lib/academic/yearCohorts";
import { requireAdmin, requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("academic_years")
      .select("id, name, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const years = await Promise.all(
      (data ?? []).map(async (row) => {
        const cfg = await loadYearCohortConfig(supabase, row.id as string);
        return {
          id: row.id,
          name: row.name,
          is_active: row.is_active,
          created_at: row.created_at,
          cohort_a_id: cfg?.cohort_a_id ?? null,
          cohort_b_id: cfg?.cohort_b_id ?? null,
          cohort_a_name: cfg?.cohort_a_name ?? null,
          cohort_b_name: cfg?.cohort_b_name ?? null,
        };
      }),
    );

    return NextResponse.json({ years });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, years: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  await requireAdmin();
  return NextResponse.json(
    { error: "ליצירת שנה חדשה השתמשי במסך «פתיחת שנת לימודים»" },
    { status: 400 },
  );
}
