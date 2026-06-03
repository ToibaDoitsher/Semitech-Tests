import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  normalizeMultiTargetInput,
  rowToMultiTarget,
  validateMultiTarget,
} from "@/lib/assignments/multiTarget";
import {
  EXAM_HARD_DELETE_PHRASE,
  hardDeleteExam,
  previewExamHardDelete,
} from "@/lib/exams/deleteExam";
import { isTeachingTrackId } from "@/lib/exams/logic";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { syncExamStudentsToTarget } from "@/lib/exams/syncExamStudents";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cascadeTeacherForAssignment } from "@/lib/teachers/cascadeTeacherChange";
import type { TeachingMode, TeachingTrackType } from "@/lib/types/db";
import {
  isTeachingModeValue,
  isTeachingSelectionComplete,
  teachingModeToExamDb,
  type TeachingModeSelection,
} from "@/lib/teachers/teachingMode";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const { data: exam, error: eErr } = await supabase
    .from("exams")
    .select("*, teachers ( id, first_name, last_name, full_name_generated )")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (eErr || !exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });

  const row = exam as { id: string };
  const labels = await resolveExamTargetLabels(supabase, [
    { id: row.id, ...rowToMultiTarget(exam) },
  ]);
  const examEnriched = { ...exam, target_label: labels[row.id] ?? "—" };
  const delete_preview = await previewExamHardDelete(supabase, id);

  const { data: lines, error: lErr } = await supabase
    .from("exam_students")
    .select("id, status, updated_at, student_id")
    .eq("exam_id", id);

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  const studentIds = [...new Set((lines ?? []).map((l) => l.student_id))];
  type StudentLine = {
    id: string;
    first_name: string;
    last_name: string;
    tz: string;
    is_psychology?: boolean;
    teaching_track_type?: "full" | "short" | null;
    classes?: { name: string } | { name: string }[] | null;
    tracks?: { name: string } | { name: string }[] | null;
    specializations?: { name: string } | { name: string }[] | null;
    secondary_specializations?: { name: string } | { name: string }[] | null;
  };
  const byStudent: Record<string, StudentLine> = {};

  if (studentIds.length) {
    const { data: studs } = await supabase
      .from("students")
      .select(
        `id, first_name, last_name, tz, is_psychology, teaching_track_type,
        classes ( name ),
        tracks ( name ),
        specializations:specializations!students_specialization_id_fkey ( name ),
        secondary_specializations:specializations!students_secondary_specialization_id_fkey ( name )`,
      )
      .in("id", studentIds);

    for (const s of studs ?? []) {
      const r = s as StudentLine;
      byStudent[r.id] = r;
    }
  }

  const exam_students = (lines ?? [])
    .map((l) => ({
      ...l,
      students: byStudent[l.student_id] ?? null,
    }))
    .sort((a, b) => {
      const la = `${a.students?.last_name ?? ""} ${a.students?.first_name ?? ""}`;
      const lb = `${b.students?.last_name ?? ""} ${b.students?.first_name ?? ""}`;
      return la.localeCompare(lb, "he");
    });

  return NextResponse.json({ exam: examEnriched, exam_students, delete_preview });
}

type PatchBody = {
  exam_date?: string;
  grade_levels?: string[];
  class_ids?: string[];
  track_ids?: string[];
  specialization_ids?: string[];
  psychology_enabled?: boolean;
  applies_to_all_in_grade?: boolean;
  teaching_track_type?: TeachingMode | TeachingTrackType | null | "";
  teacher_id?: string;
};

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as PatchBody;

  const { data: examBefore, error: loadErr } = await supabase
    .from("exams")
    .select(
      "id, academic_year_id, teacher_id, teacher_assignment_id, subject, exam_date, assignment_category, grade_levels, class_ids, track_ids, specialization_ids, psychology_enabled, applies_to_all_in_grade, teaching_track_type, makeup_locked_at",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!examBefore) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });
  if (examBefore.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מבחן לא שייך לשנה הנוכחית" }, { status: 403 });
  }

  const wantsTargetChange =
    body.grade_levels !== undefined ||
    body.class_ids !== undefined ||
    body.track_ids !== undefined ||
    body.specialization_ids !== undefined ||
    body.psychology_enabled !== undefined ||
    body.applies_to_all_in_grade !== undefined ||
    body.teaching_track_type !== undefined;

  if (examBefore.makeup_locked_at && wantsTargetChange) {
    return NextResponse.json(
      { error: "המבחן ננעל להשלמות — לא ניתן לערוך יעד. אפשר לעדכן רק תאריך." },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = {};

  if (body.exam_date !== undefined) {
    const v = (body.exam_date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return NextResponse.json({ error: "תאריך לא תקין (YYYY-MM-DD)" }, { status: 400 });
    }
    update.exam_date = v;
  }

  let teacherChanged = false;
  if (body.teacher_id !== undefined) {
    const newTeacherId = (body.teacher_id ?? "").trim();
    if (!newTeacherId) {
      return NextResponse.json({ error: "מורה חובה" }, { status: 400 });
    }
    const { data: teacherCheck, error: tErr } = await supabase
      .from("teachers")
      .select("id, academic_year_id")
      .eq("id", newTeacherId)
      .is("deleted_at", null)
      .maybeSingle();
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    if (!teacherCheck) {
      return NextResponse.json({ error: "מורה לא נמצאה" }, { status: 400 });
    }
    if ((teacherCheck as { academic_year_id: string }).academic_year_id !== scope.year.id) {
      return NextResponse.json({ error: "מורה לא שייכת לשנה הנוכחית" }, { status: 400 });
    }
    if (newTeacherId !== (examBefore as { teacher_id: string }).teacher_id) {
      update.teacher_id = newTeacherId;
      teacherChanged = true;
    }
  }

  let newTarget = rowToMultiTarget(examBefore);
  let newTeachingTrackType =
    (examBefore.teaching_track_type as TeachingTrackType | null) ?? null;

  if (wantsTargetChange) {
    newTarget = normalizeMultiTargetInput({
      grade_levels: body.grade_levels ?? newTarget.grade_levels,
      class_ids: body.class_ids ?? newTarget.class_ids,
      track_ids: body.track_ids ?? newTarget.track_ids,
      specialization_ids: body.specialization_ids ?? newTarget.specialization_ids,
      psychology_enabled:
        body.psychology_enabled !== undefined
          ? body.psychology_enabled
          : newTarget.psychology_enabled,
      applies_to_all_in_grade:
        body.applies_to_all_in_grade !== undefined
          ? body.applies_to_all_in_grade
          : newTarget.applies_to_all_in_grade,
    });

    const targetErr = validateMultiTarget(examBefore.assignment_category, newTarget);
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

    if (body.teaching_track_type !== undefined) {
      const v = body.teaching_track_type;
      const selection: TeachingModeSelection = isTeachingModeValue(v) ? v : "";

      if (newTarget.track_ids.length) {
        const checks = await Promise.all(
          newTarget.track_ids.map((tid) => isTeachingTrackId(supabase, tid)),
        );
        const hasTeachingTrack = checks.some(Boolean);
        if (hasTeachingTrack && !isTeachingSelectionComplete(selection)) {
          return NextResponse.json(
            { error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" },
            { status: 400 },
          );
        }
        if (!hasTeachingTrack) {
          newTeachingTrackType = null;
        } else {
          newTeachingTrackType = teachingModeToExamDb(selection);
        }
      } else {
        newTeachingTrackType = null;
      }
    } else if (newTarget.track_ids.length) {
      const checks = await Promise.all(
        newTarget.track_ids.map((tid) => isTeachingTrackId(supabase, tid)),
      );
      const hasTeachingTrack = checks.some(Boolean);
      if (!hasTeachingTrack) newTeachingTrackType = null;
    } else {
      newTeachingTrackType = null;
    }

    update.grade_levels = newTarget.grade_levels;
    update.class_ids = newTarget.class_ids;
    update.track_ids = newTarget.track_ids;
    update.specialization_ids = newTarget.specialization_ids;
    update.psychology_enabled = newTarget.psychology_enabled;
    update.applies_to_all_in_grade = newTarget.applies_to_all_in_grade;
    update.teaching_track_type = newTeachingTrackType;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "אין מה לעדכן" }, { status: 400 });
  }

  const { data: examAfter, error: upErr } = await supabase
    .from("exams")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  let syncResult: Awaited<ReturnType<typeof syncExamStudentsToTarget>> | null = null;
  if (wantsTargetChange) {
    syncResult = await syncExamStudentsToTarget(supabase, id);
    if (syncResult && "error" in syncResult) {
      return NextResponse.json({ error: syncResult.error }, { status: 400 });
    }
  }

  // Cascade: שינוי מורה במבחן מעדכן גם את השיבוץ-המקור וגם את כל המבחנים האחים
  // (שנוצרו מאותו teacher_assignment_id) + ה-teacher_snapshot ב-exam_students.
  let teacherCascade: {
    assignment_updated: boolean;
    exams_updated: number;
    snapshots_updated: number;
  } | null = null;
  if (teacherChanged) {
    const assignmentId = (examBefore as { teacher_assignment_id: string | null })
      .teacher_assignment_id;
    if (assignmentId) {
      const { error: asgErr } = await supabase
        .from("teacher_assignments")
        .update({ teacher_id: update.teacher_id as string })
        .eq("id", assignmentId);
      if (asgErr) {
        console.warn(
          "[PATCH /api/exams/:id] לא הצלחתי לעדכן את השיבוץ הקשור:",
          asgErr.message,
        );
      }

      const cascadeResult = await cascadeTeacherForAssignment(
        supabase,
        assignmentId,
        update.teacher_id as string,
      );
      if ("error" in cascadeResult) {
        console.warn(
          "[PATCH /api/exams/:id] cascade נכשל:",
          cascadeResult.error,
        );
        teacherCascade = {
          assignment_updated: !asgErr,
          exams_updated: 0,
          snapshots_updated: 0,
        };
      } else {
        teacherCascade = {
          assignment_updated: !asgErr,
          exams_updated: cascadeResult.examsUpdated,
          snapshots_updated: cascadeResult.snapshotsUpdated,
        };
      }
    } else {
      teacherCascade = {
        assignment_updated: false,
        exams_updated: 0,
        snapshots_updated: 0,
      };
    }
  }

  const user = await getCurrentUser(supabase);
  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "exam",
    entityId: id,
    actionType: "update",
    entityNameSnapshot: (examAfter as { subject?: string }).subject ?? null,
    oldValue: examBefore,
    newValue: examAfter,
  });

  const labels = await resolveExamTargetLabels(supabase, [
    { id, ...rowToMultiTarget(examAfter) },
  ]);

  return NextResponse.json({
    exam: { ...examAfter, target_label: labels[id] ?? null },
    sync: syncResult,
    teacher_cascade: teacherCascade,
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirm_phrase?: string };
  if (body.confirm_phrase?.trim() !== EXAM_HARD_DELETE_PHRASE) {
    return NextResponse.json(
      { error: `יש להקליד בדיוק: ${EXAM_HARD_DELETE_PHRASE}` },
      { status: 400 },
    );
  }

  const { data: exam, error: loadErr } = await supabase
    .from("exams")
    .select("id, academic_year_id, subject, exam_date")
    .eq("id", id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });
  if (exam.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מבחן לא שייך לשנה הנוכחית" }, { status: 403 });
  }

  const result = await hardDeleteExam(supabase, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
