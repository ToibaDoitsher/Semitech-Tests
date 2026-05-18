import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createOneExam } from "@/lib/exams/createOneExam";
import { resolveTeacherAssignmentForGrade } from "@/lib/exams/resolveAssignmentForGrade";
import { getGradeLevelOptionById } from "@/lib/gradeLevels/options";
import type { TeachingTrackType } from "@/lib/types/db";
import type { GradeLevel } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { formatGradeLabel, parseGradeLevel } from "@/lib/academicYears/labels";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeLevel = parseGradeLevel(searchParams.get("grade_level") ?? "");

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));

  let query = notDeleted(supabase.from("exams").select(`*, ${TEACHER_EMBED_IN_EXAM}`))
    .eq("academic_year_id", scope.year.id)
    .order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (gradeLevel) query = query.eq("grade_level", gradeLevel);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const exams = data ?? [];
  const labels = await resolveExamTargetLabels(
    supabase,
    exams.map((e) => {
      const row = e as {
        id: string;
        class_id: string | null;
        specialization_id: string | null;
        track_id: string | null;
        psychology_enabled: boolean;
      };
      return {
        id: row.id,
        class_id: row.class_id,
        specialization_id: row.specialization_id,
        track_id: row.track_id,
        psychology_enabled: row.psychology_enabled,
      };
    }),
  );

  const enriched = exams.map((e) => {
    const row = e as { id: string; grade_level: GradeLevel };
    return {
      ...e,
      target_label: labels[row.id] ?? row.id,
      year_label: formatGradeLabel(row.grade_level),
    };
  });

  return NextResponse.json({ exams: enriched, readOnly: scope.readOnly, academicYear: scope.year });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    exam_date?: string;
    grade_level?: string;
    grade_level_option_id?: string;
    teacher_assignment_id?: string;
    teaching_track_type?: TeachingTrackType | null;
  };

  const teacher_id = body.teacher_id?.trim();
  const subject = (body.subject ?? "").trim();
  const exam_date = (body.exam_date ?? "").trim();
  const teacher_assignment_id = (body.teacher_assignment_id ?? "").trim();

  if (!teacher_id || !subject || !exam_date || !teacher_assignment_id) {
    return NextResponse.json({ error: "מורה, שיבוץ, מקצוע ותאריך חובה" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const yearScope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (yearScope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  let gradeLevels: GradeLevel[];
  const optionId = body.grade_level_option_id?.trim();
  if (optionId) {
    const opt = await getGradeLevelOptionById(supabase, optionId);
    if (!opt?.is_active) {
      return NextResponse.json({ error: "אפשרות שכבה לא נמצאה" }, { status: 400 });
    }
    gradeLevels = opt.grade_levels;
  } else {
    const gl = parseGradeLevel(String(body.grade_level ?? ""));
    if (!gl) return NextResponse.json({ error: "בחרי שכבה" }, { status: 400 });
    gradeLevels = [gl];
  }

  if (!gradeLevels.length) {
    return NextResponse.json({ error: "בחרי שכבה" }, { status: 400 });
  }

  const { data: templateTa, error: taLoadErr } = await supabase
    .from("teacher_assignments")
    .select(
      "id, grade_level, teacher_id, subject, assignment_category, class_id, specialization_id, track_id, psychology_enabled, lesson_name",
    )
    .eq("id", teacher_assignment_id)
    .maybeSingle();
  if (taLoadErr) return NextResponse.json({ error: taLoadErr.message }, { status: 500 });
  if (!templateTa) return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 400 });
  if (templateTa.teacher_id !== teacher_id || templateTa.subject !== subject) {
    return NextResponse.json({ error: "שיבוץ לא תואם למורה/מקצוע" }, { status: 400 });
  }

  const teaching_track_type: TeachingTrackType | null =
    body.teaching_track_type === "full" || body.teaching_track_type === "short"
      ? body.teaching_track_type
      : null;

  const user = await getCurrentUser(supabase);
  const created: { exam: Record<string, unknown>; students_count: number; grade_level: GradeLevel }[] = [];

  for (const gradeLevel of gradeLevels) {
    const resolved = await resolveTeacherAssignmentForGrade(
      supabase,
      yearScope.year.id,
      {
        id: templateTa.id as string,
        grade_level: templateTa.grade_level as GradeLevel,
        teacher_id: templateTa.teacher_id as string,
        subject: templateTa.subject as string,
        assignment_category: templateTa.assignment_category as string,
        class_id: templateTa.class_id as string | null,
        specialization_id: templateTa.specialization_id as string | null,
        track_id: templateTa.track_id as string | null,
        psychology_enabled: templateTa.psychology_enabled as boolean,
        lesson_name: templateTa.lesson_name as string | null,
      },
      gradeLevel,
    );
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const result = await createOneExam({
      supabase,
      academicYearId: yearScope.year.id,
      academicYearName: yearScope.year.year_name,
      teacherId: teacher_id,
      subject,
      examDate: exam_date,
      gradeLevel,
      assignmentId: resolved.id,
      teachingTrackType: teaching_track_type,
      auditUserId: user?.id ?? null,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    created.push({ ...result, grade_level: gradeLevel });
  }

  const studentsTotal = created.reduce((s, c) => s + c.students_count, 0);

  return NextResponse.json({
    exam: created[0]?.exam,
    exams: created.map((c) => c.exam),
    students_count: studentsTotal,
    created_count: created.length,
  });
}
