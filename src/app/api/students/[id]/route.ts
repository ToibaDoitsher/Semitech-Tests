import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { enrichStudentsWithGradeForYear } from "@/lib/academic/studentGrade.server";
import { asStudentRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { recordStudentHistoryIfChanged } from "@/lib/students/history";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const studentSelect = await getStudentWithLookupsSelect();
  const { data: student, error: sErr } = await supabase
    .from("students")
    .select(studentSelect)
    .eq("id", id)
    .single();
  if (sErr || !student) return NextResponse.json({ error: "לא נמצאה תלמידה" }, { status: 404 });

  const row = asStudentRow(student);
  const enriched = (await enrichStudentsWithGradeForYear(supabase, [row]))[0];

  const { data: examStudents } = await supabase
    .from("exam_students")
    .select("id, status, updated_at, exam_id")
    .eq("student_id", id)
    .order("updated_at", { ascending: false });

  const examIds = [...new Set((examStudents ?? []).map((r) => r.exam_id))];
  let examsMeta: Record<string, { subject: string; exam_date: string; teacher_name: string | null }> =
    {};

  if (examIds.length) {
    const { data: exams } = await supabase
      .from("exams")
      .select("id, subject, exam_date, teachers(name)")
      .in("id", examIds);

    for (const e of exams ?? []) {
      const raw = e as { id: string; subject: string; exam_date: string; teachers: unknown };
      const tn = raw.teachers as { name?: string } | { name?: string }[] | null | undefined;
      const name =
        Array.isArray(tn) ? tn[0]?.name : typeof tn === "object" && tn && "name" in tn ? tn.name : undefined;
      examsMeta[raw.id] = {
        subject: raw.subject,
        exam_date: raw.exam_date,
        teacher_name: name ?? null,
      };
    }
  }

  const exam_students = (examStudents ?? []).map((es) => ({
    ...es,
    exam: examsMeta[es.exam_id] ?? null,
  }));

  const { data: makeups } = await supabase
    .from("makeup_exams")
    .select("id, status, created_at, completed_at, exam_id")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  const makeupExamIds = [...new Set((makeups ?? []).map((m) => m.exam_id))];
  let makeupExamsMeta: Record<string, { subject: string; exam_date: string }> = {};
  if (makeupExamIds.length) {
    const { data: mex } = await supabase
      .from("exams")
      .select("id, subject, exam_date")
      .in("id", makeupExamIds);
    for (const e of mex ?? []) {
      const row = e as { id: string; subject: string; exam_date: string };
      makeupExamsMeta[row.id] = { subject: row.subject, exam_date: row.exam_date };
    }
  }

  const makeupsEnriched = (makeups ?? []).map((m) => ({
    ...m,
    exam: makeupExamsMeta[m.exam_id] ?? null,
  }));

  return NextResponse.json({ student: enriched, exam_students, makeups: makeupsEnriched });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const supabase = createSupabaseAdminClient();
  const user = await getCurrentUser(supabase);

  const { data: before } = await supabase
    .from("students")
    .select("class_id, specialization_id, track_id, cohort_id")
    .eq("id", id)
    .single();

  const patch: Record<string, unknown> = {
    first_name: body.first_name,
    last_name: body.last_name,
    tz: body.tz,
    cohort_id: body.cohort_id,
    class_id: body.class_id,
    specialization_id: body.specialization_id === "" ? null : body.specialization_id,
    track_id: body.track_id === "" ? null : body.track_id,
  };

  const { data, error } = await supabase
    .from("students")
    .update(patch)
    .eq("id", id)
    .select(await getStudentWithLookupsSelect())
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (before && data) {
    const after = asStudentRow(data);
    await recordStudentHistoryIfChanged(
      supabase,
      id,
      before as Pick<typeof after, "class_id" | "specialization_id" | "track_id" | "cohort_id">,
      after,
      user?.id ?? null,
    );
  }

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "student",
    entityId: id,
    actionType: "update",
    oldValue: before,
    newValue: data,
  });

  return NextResponse.json({ student: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const user = await getCurrentUser(supabase);

  const { data: before } = await supabase.from("students").select("*").eq("id", id).single();
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "student",
    entityId: id,
    actionType: "delete",
    oldValue: before,
  });

  return NextResponse.json({ ok: true });
}
