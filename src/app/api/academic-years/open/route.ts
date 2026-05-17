import { NextResponse } from "next/server";
import { openAcademicYear } from "@/lib/academic/openYear";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireCurrentUser();
  const body = (await request.json()) as {
    name?: string;
    new_cohort_number?: string | number;
  };

  const newCohortNumber = Number.parseInt(String(body.new_cohort_number ?? ""), 10);

  const supabase = createSupabaseAdminClient();
  const { result, error } = await openAcademicYear(supabase, {
    name: body.name ?? "",
    newCohortNumber,
  });

  if (error || !result) return NextResponse.json({ error: error ?? "שגיאה" }, { status: 400 });
  return NextResponse.json({ ok: true, year: result });
}
