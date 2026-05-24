import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: existing } = await supabase
    .from("makeup_tracking")
    .select("academic_year_id")
    .eq("id", id)
    .maybeSingle();
  if (existing && existing.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "רשומה לא שייכת לשנה הנוכחית" }, { status: 403 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("makeup_tracking")
    .update({ sent_to_teacher_at: now })
    .eq("id", id)
    .select("id, sent_to_teacher_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ tracking: data });
}
