import { NextResponse } from "next/server";
import { enrichStudentsWithGrade, formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { formatYearGradeLabel } from "@/lib/academicYears/labels";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { asStudentRows, type StudentWithLookupsRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { pickLookupName } from "@/lib/lookups/display";
import { assignmentTargetTypeLabel } from "@/lib/assignments/target";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherDisplayName, teacherEmbedDisplayName, teachingModeLabel } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const KINDS = new Set([
  "students",
  "teachers",
  "exams",
  "assignments",
  "makeups",
  "tracking",
  "exam-lines",
]);

const examStudentStatusHe: Record<string, string> = {
  pending: "ממתין",
  took: "נבחנה במועד",
  missing: "לא נבחנה",
  makeup: "השלמה",
  completed: "הושלמה בהשלמה",
};

const targetTypeHe: Record<string, string> = {
  psychology: "פסיכולוגיה",
  class: "כיתה",
  specialization: "התמחות",
  track: "מסלול",
};

const makeupStatusHe: Record<string, string> = {
  open: "פתוח",
  completed: "הושלם",
};

function teacherNameCell(teachers: unknown): string {
  return teacherEmbedDisplayName(teachers as Parameters<typeof teacherEmbedDisplayName>[0]);
}

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null;
  return v;
}

type ExamJoin = {
  id: string;
  subject: string;
  exam_date: string;
  class_id: string | null;
  specialization_id: string | null;
  track_id: string | null;
  psychology_enabled: boolean;
  teachers: unknown;
};

type StudentJoin = { first_name: string; last_name: string; tz: string };

async function paginateSelect<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const chunk = data ?? [];
    out.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export async function GET(request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "סוג ייצוא לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );

  try {
    if (kind === "students") {
      const studentSelect = await getStudentWithLookupsSelect();
      const data = await paginateSelect<StudentWithLookupsRow>(async (from, to) => {
        const res = await supabase
          .from("students")
          .select(studentSelect)
          .eq("academic_year_id", scope.year.id)
          .order("last_name")
          .order("first_name")
          .range(from, to);
        return {
          data: asStudentRows(res.data),
          error: res.error,
        };
      });
      const rows = asStudentRows(data);
      const enriched = enrichStudentsWithGrade(rows);
      const exportRows = enriched.map((s) => ({
        תעודת_זהות: s.tz,
        שם_פרטי: s.first_name,
        שם_משפחה: s.last_name,
        שנתון_ושכבה: s.year_label ?? formatYearGradeLabel(s.year_group, s.grade_level),
        שכבה: formatCohortGradeLabel(s.grade_level),
        כיתה: pickLookupName(s.classes),
        התמחות: pickLookupName(s.specializations),
        מסלול: pickLookupName(s.tracks),
      }));
      return NextResponse.json({ rows: exportRows });
    }

    if (kind === "teachers") {
      const data = await paginateSelect((from, to) =>
        notDeleted(supabase.from("teachers").select("first_name, last_name, full_name_generated, tz, email, created_at"))
          .order("last_name")
          .order("first_name")
          .range(from, to),
      );
      const rows = data.map((t) => {
        const r = t as {
          first_name: string;
          last_name: string;
          full_name_generated?: string;
          tz?: string | null;
          email?: string | null;
          created_at: string;
        };
        return {
          שם: teacherDisplayName(r),
          תז: r.tz ?? "",
          מייל: r.email ?? "",
          נוצר: r.created_at?.slice(0, 10) ?? "",
        };
      });
      return NextResponse.json({ rows });
    }

    if (kind === "exams") {
      const data = await paginateSelect((from, to) =>
        supabase
          .from("exams")
          .select("id, subject, exam_date, class_id, specialization_id, track_id, psychology_enabled, year_group, grade_level, teachers ( id, first_name, last_name, full_name_generated )")
          .eq("academic_year_id", scope.year.id)
          .order("exam_date", { ascending: false })
          .range(from, to),
      );
      const exams = data as ExamJoin[];
      const labels = await resolveExamTargetLabels(
        supabase,
        exams.map((e) => ({
          id: e.id,
          class_id: e.class_id,
          specialization_id: e.specialization_id,
          track_id: e.track_id,
          psychology_enabled: e.psychology_enabled,
        })),
      );
      const rows = exams.map((e) => {
        const row = e as ExamJoin & { year_group: number; grade_level: string };
        return {
          מקצוע: e.subject,
          תאריך: e.exam_date,
          מורה: teacherNameCell(e.teachers),
          שנתון_ושכבה: formatYearGradeLabel(row.year_group, row.grade_level as "א" | "ב" | "ג"),
          סוג_יעד: assignmentTargetTypeLabel(e),
          שם_יעד: labels[e.id] ?? "—",
        };
      });
      return NextResponse.json({ rows });
    }

    if (kind === "assignments") {
      const data = await paginateSelect((from, to) =>
        notDeleted(supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS))
          .eq("academic_year_id", scope.year.id)
          .order("subject")
          .range(from, to),
      );
      const raw = data as (ExamJoin & {
        lesson_name?: string | null;
        teaching_mode?: string | null;
        year_group: number;
        grade_level: string;
      })[];
      const labels = await resolveExamTargetLabels(
        supabase,
        raw.map((a) => ({
          id: a.id,
          class_id: a.class_id,
          specialization_id: a.specialization_id,
          track_id: a.track_id,
          psychology_enabled: a.psychology_enabled,
        })),
      );
      const rows = raw.map((a) => {
        const row = a as typeof a & { assignment_category?: "חובה" | "התמחות" };
        const targetCols = {
          class_id: a.class_id,
          specialization_id: a.specialization_id,
          track_id: a.track_id,
          psychology_enabled: a.psychology_enabled,
        };
        return {
          מורה: teacherNameCell(a.teachers),
          מקצוע: a.subject,
          שם_שיעור: a.lesson_name ?? "",
          שנתון_ושכבה: formatYearGradeLabel(a.year_group, a.grade_level as "א" | "ב" | "ג"),
          סוג_שיבוץ: row.assignment_category ?? "—",
          סוג_יעד: assignmentTargetTypeLabel(targetCols, row.assignment_category),
          ערך_שיבוץ: labels[a.id] ?? "—",
          סוג_הוראה: teachingModeLabel(a.teaching_mode),
        };
      });
      return NextResponse.json({ rows });
    }

    if (kind === "makeups") {
      const data = await paginateSelect((from, to) =>
        supabase
          .from("makeup_exams")
          .select("id, status, created_at, completed_at, student_id, exam_id")
          .order("created_at", { ascending: false })
          .range(from, to),
      );
      const studentIds = [...new Set(data.map((r) => (r as { student_id: string }).student_id))];
      const examIds = [...new Set(data.map((r) => (r as { exam_id: string }).exam_id))];
      const studentsBy: Record<string, { first_name: string; last_name: string; tz: string }> = {};
      const examsBy: Record<string, { subject: string; exam_date: string; teachers: unknown }> = {};
      if (studentIds.length) {
        const { data: studs } = await supabase.from("students").select("id, first_name, last_name, tz").in("id", studentIds);
        for (const s of studs ?? []) {
          const row = s as { id: string; first_name: string; last_name: string; tz: string };
          studentsBy[row.id] = { first_name: row.first_name, last_name: row.last_name, tz: row.tz };
        }
      }
      if (examIds.length) {
        const { data: exams } = await supabase
          .from("exams")
          .select("id, subject, exam_date, teachers ( id, first_name, last_name, full_name_generated )")
          .in("id", examIds);
        for (const e of exams ?? []) {
          const row = e as { id: string; subject: string; exam_date: string; teachers: unknown };
          examsBy[row.id] = { subject: row.subject, exam_date: row.exam_date, teachers: row.teachers };
        }
      }
      const rows = data.map((r) => {
        const row = r as {
          status: string;
          created_at: string;
          completed_at: string | null;
          student_id: string;
          exam_id: string;
        };
        const st = studentsBy[row.student_id];
        const ex = examsBy[row.exam_id];
        return {
          סטטוס: makeupStatusHe[row.status] ?? row.status,
          נוצר: row.created_at?.slice(0, 19) ?? "",
          הושלם: row.completed_at?.slice(0, 19) ?? "",
          שם_פרטי: st?.first_name ?? "",
          שם_משפחה: st?.last_name ?? "",
          תעודת_זהות: st?.tz ?? "",
          מקצוע: ex?.subject ?? "",
          תאריך_מבחן: ex?.exam_date ?? "",
          מורה: ex ? teacherNameCell(ex.teachers) : "",
        };
      });
      return NextResponse.json({ rows });
    }

    if (kind === "tracking") {
      const data = await paginateSelect((from, to) =>
        supabase
          .from("exam_tracking")
          .select(
            "id, submitted_exam, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id",
          )
          .order("id", { ascending: false })
          .range(from, to),
      );
      const examIds = [...new Set(data.map((r) => (r as { exam_id: string }).exam_id))];
      const examsBy: Record<string, { subject: string; exam_date: string; teachers: unknown }> = {};
      if (examIds.length) {
        const { data: exams } = await supabase
          .from("exams")
          .select("id, subject, exam_date, teachers ( id, first_name, last_name, full_name_generated )")
          .in("id", examIds);
        for (const e of exams ?? []) {
          const row = e as { id: string; subject: string; exam_date: string; teachers: unknown };
          examsBy[row.id] = { subject: row.subject, exam_date: row.exam_date, teachers: row.teachers };
        }
      }
      const rows = data.map((r) => {
        const row = r as {
          submitted_exam: string | null;
          approved_by_coordinator: boolean;
          sent_for_review: boolean;
          grades_submitted: boolean;
          grades_approved: boolean;
          transferred_to_system: boolean;
          exam_id: string;
        };
        const ex = examsBy[row.exam_id];
        return {
          מקצוע: ex?.subject ?? "",
          תאריך: ex?.exam_date ?? "",
          מורה: ex ? teacherNameCell(ex.teachers) : "",
          הוגש_מבחן: row.submitted_exam ? row.submitted_exam.slice(0, 19) : "",
          אושר_על_ידי_רכזת: row.approved_by_coordinator ? "כן" : "לא",
          נשלח_לבדיקה: row.sent_for_review ? "כן" : "לא",
          ציונים_הוגשו: row.grades_submitted ? "כן" : "לא",
          ציונים_אושרו: row.grades_approved ? "כן" : "לא",
          הועבר_למערכת: row.transferred_to_system ? "כן" : "לא",
        };
      });
      return NextResponse.json({ rows });
    }

    /* exam-lines — כל שורות תלמידה–מבחן עם סטטוס */
    const lines = await paginateSelect((from, to) =>
      supabase
        .from("exam_students")
        .select(
          `
          id,
          status,
          updated_at,
          student_id,
          exam_id,
          students ( first_name, last_name, tz ),
          exams ( id, subject, exam_date, class_id, specialization_id, track_id, psychology_enabled, ${TEACHER_EMBED_IN_EXAM} )
        `,
        )
        .order("exam_id")
        .range(from, to),
    );

    const examMeta = new Map<string, ExamJoin>();
    for (const line of lines) {
      const raw = line as {
        exam_id: string;
        exams: ExamJoin | ExamJoin[] | null;
      };
      const ex = unwrapOne(raw.exams);
      if (ex && !examMeta.has(raw.exam_id)) {
        examMeta.set(raw.exam_id, ex);
      }
    }
    const labelInputs = [...examMeta.entries()].map(([id, m]) => ({
      id,
      class_id: m.class_id,
      specialization_id: m.specialization_id,
      track_id: m.track_id,
      psychology_enabled: m.psychology_enabled,
    }));
    const examTargetLabels = await resolveExamTargetLabels(supabase, labelInputs);

    const rows = lines.map((line) => {
      const raw = line as {
        status: string;
        updated_at: string;
        exam_id: string;
        students: StudentJoin | StudentJoin[] | null;
        exams: ExamJoin | ExamJoin[] | null;
      };
      const ex = unwrapOne(raw.exams);
      const st = unwrapOne(raw.students);
      const targetLabel = ex ? examTargetLabels[raw.exam_id] ?? "—" : "";
      return {
        מקצוע: ex?.subject ?? "",
        תאריך_מבחן: ex?.exam_date ?? "",
        מורה: ex ? teacherNameCell(ex.teachers) : "",
        סוג_יעד: ex ? assignmentTargetTypeLabel(ex) : "",
        שם_יעד: targetLabel,
        שם_פרטי: st?.first_name ?? "",
        שם_משפחה: st?.last_name ?? "",
        תעודת_זהות: st?.tz ?? "",
        סטטוס_במבחן: examStudentStatusHe[raw.status] ?? raw.status,
        עודכן: raw.updated_at?.slice(0, 19) ?? "",
      };
    });

    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה" }, { status: 500 });
  }
}
