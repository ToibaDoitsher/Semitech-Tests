import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { ensureMakeupTrackingBatch } from "@/lib/makeupTracking/sync";
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

  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("id, makeup_locked_at, academic_year_id")
    .eq("id", examId)
    .maybeSingle();
  if (examErr) return NextResponse.json({ error: examErr.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });
  if (exam.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מבחן לא שייך לשנה הנוכחית" }, { status: 403 });
  }
  if (exam.makeup_locked_at) {
    return NextResponse.json({ error: "המבחן כבר ננעל להשלמות" }, { status: 400 });
  }

  const { data: missingRows, error: qErr } = await supabase
    .from("exam_students")
    .select("student_id")
    .eq("exam_id", examId)
    .eq("status", "missing");

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const studentIds = (missingRows ?? []).map((r) => r.student_id);
  if (!studentIds.length) {
    return NextResponse.json({ created: 0, message: "אין תלמידות במצב חסר" });
  }

  const inserts = studentIds.map((student_id) => ({
    academic_year_id: exam.academic_year_id as string,
    student_id,
    exam_id: examId,
    status: "open" as const,
    completed_at: null as null,
  }));

  const { data: insertedMakeups, error: insErr } = await supabase
    .from("makeup_exams")
    .upsert(inserts, { onConflict: "student_id,exam_id", ignoreDuplicates: false })
    .select("id, student_id, exam_id");

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  const trackItems = (insertedMakeups ?? []).map((m) => ({
    studentId: m.student_id as string,
    examId: m.exam_id as string,
    makeupExamId: m.id as string,
  }));
  const track = await ensureMakeupTrackingBatch(supabase, trackItems);
  if (track.error) return NextResponse.json({ error: track.error }, { status: 400 });

  const { error: upErr } = await supabase
    .from("exam_students")
    .update({ status: "makeup" })
    .eq("exam_id", examId)
    .eq("status", "missing");

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  const now = new Date().toISOString();
  const { error: lockErr } = await supabase
    .from("exams")
    .update({ makeup_locked_at: now })
    .eq("id", examId);
  if (lockErr) return NextResponse.json({ error: lockErr.message }, { status: 400 });

  return NextResponse.json({ created: studentIds.length, locked: true });
}
