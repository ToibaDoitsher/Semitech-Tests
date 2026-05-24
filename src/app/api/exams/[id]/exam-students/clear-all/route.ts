import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: examId } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: exam, error: eErr } = await supabase
    .from("exams")
    .select("id, academic_year_id")
    .eq("id", examId)
    .maybeSingle();
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });
  if (exam.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מבחן לא שייך לשנה הנוכחית" }, { status: 403 });
  }

  const { error: mtErr } = await supabase.from("makeup_tracking").delete().eq("exam_id", examId);
  if (mtErr) return NextResponse.json({ error: mtErr.message }, { status: 400 });

  const { error: meErr } = await supabase.from("makeup_exams").delete().eq("exam_id", examId);
  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });

  const { data, error } = await supabase
    .from("exam_students")
    .delete()
    .eq("exam_id", examId)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: etErr } = await supabase.from("exam_tracking").delete().eq("exam_id", examId);
  if (etErr) return NextResponse.json({ error: etErr.message }, { status: 400 });

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
