import { NextResponse } from "next/server";
import { formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { resolveAcademicYearId } from "@/lib/academic/year";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { asStudentRows, type StudentWithLookupsRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { pickLookupName } from "@/lib/lookups/display";
import type { ExamTargetType } from "@/lib/types/db";
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
  class: "כיתה",
  specialization: "התמחות",
  track: "מסלול",
};

const makeupStatusHe: Record<string, string> = {
  open: "פתוח",
  completed: "הושלם",
};

function teacherNameCell(teachers: unknown): string {
  const tn = teachers as { name?: string } | { name?: string }[] | null | undefined;
  if (Array.isArray(tn)) return tn[0]?.name ?? "";
  if (typeof tn === "object" && tn && "name" in tn) return String((tn as { name: string }).name);
  return "";
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
  target_type: ExamTargetType;
  target_id: string;
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

export async function GET(_request: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "סוג ייצוא לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    if (kind === "students") {
      const yearId = await resolveAcademicYearId(supabase);
      const studentSelect = await getStudentWithLookupsSelect();
      const data = await paginateSelect<StudentWithLookupsRow>(async (from, to) => {
        let q = supabase
          .from("students")
          .select(studentSelect)
          .order("last_name")
          .order("first_name")
          .range(from, to);
        if (yearId) q = q.eq("academic_year_id", yearId);
        const res = await q;
        return {
          data: asStudentRows(res.data),
          error: res.error,
        };
      });
      const rows = asStudentRows(data);
      const exportRows = rows.map((s) => ({
        תעודת_זהות: s.tz,
        שם_פרטי: s.first_name,
        שם_משפחה: s.last_name,
        מחזור: s.cohort_number,
        שכבה: formatCohortGradeLabel(s.grade_level),
        כיתה: pickLookupName(s.classes),
        התמחות: pickLookupName(s.specializations),
        מסלול: pickLookupName(s.tracks),
      }));
      return NextResponse.json({ rows: exportRows });
    }

    if (kind === "teachers") {
      const data = await paginateSelect((from, to) =>
        supabase.from("teachers").select("id, name, created_at").order("name").range(from, to),
      );
      const rows = data.map((t) => {
        const r = t as { name: string; created_at: string };
        return {
          שם: r.name,
          נוצר: r.created_at?.slice(0, 10) ?? "",
        };
      });
      return NextResponse.json({ rows });
    }

    if (kind === "exams") {
      const data = await paginateSelect((from, to) =>
        supabase
          .from("exams")
          .select("id, subject, exam_date, target_type, target_id, teachers(name)")
          .order("exam_date", { ascending: false })
          .range(from, to),
      );
      const exams = data as {
        id: string;
        subject: string;
        exam_date: string;
        target_type: ExamTargetType;
        target_id: string;
        teachers: unknown;
      }[];
      const labels = await resolveExamTargetLabels(
        supabase,
        exams.map((e) => ({ id: e.id, target_type: e.target_type, target_id: e.target_id })),
      );
      const rows = exams.map((e) => ({
        מקצוע: e.subject,
        תאריך: e.exam_date,
        מורה: teacherNameCell(e.teachers),
        סוג_יעד: targetTypeHe[e.target_type] ?? e.target_type,
        שם_יעד: labels[e.id] ?? e.target_id,
      }));
      return NextResponse.json({ rows });
    }

    if (kind === "assignments") {
      const data = await paginateSelect((from, to) =>
        supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS).order("subject").range(from, to),
      );
      const raw = data as {
        id: string;
        subject: string;
        active: boolean;
        target_type: ExamTargetType;
        target_id: string;
        teachers: unknown;
        grade_levels: unknown;
      }[];
      const labels = await resolveExamTargetLabels(
        supabase,
        raw.map((a) => ({ id: a.id, target_type: a.target_type, target_id: a.target_id })),
      );
      const rows = raw.map((a) => ({
        מורה: teacherNameCell(a.teachers),
        מקצוע: a.subject,
        שכבה: pickLookupName(a.grade_levels),
        סוג_שיבוץ: targetTypeHe[a.target_type] ?? a.target_type,
        ערך_שיבוץ: labels[a.id] ?? a.target_id,
        פעיל: a.active ? "כן" : "לא",
      }));
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
        const { data: exams } = await supabase.from("exams").select("id, subject, exam_date, teachers(name)").in("id", examIds);
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
        const { data: exams } = await supabase.from("exams").select("id, subject, exam_date, teachers(name)").in("id", examIds);
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
          exams ( id, subject, exam_date, target_type, target_id, teachers ( name ) )
        `,
        )
        .order("exam_id")
        .range(from, to),
    );

    const examMeta = new Map<
      string,
      { subject: string; exam_date: string; target_type: ExamTargetType; target_id: string; teachers: unknown }
    >();
    for (const line of lines) {
      const raw = line as {
        exam_id: string;
        exams: ExamJoin | ExamJoin[] | null;
      };
      const ex = unwrapOne(raw.exams);
      if (ex && !examMeta.has(raw.exam_id)) {
        examMeta.set(raw.exam_id, {
          subject: ex.subject,
          exam_date: ex.exam_date,
          target_type: ex.target_type,
          target_id: ex.target_id,
          teachers: ex.teachers,
        });
      }
    }
    const labelInputs = [...examMeta.entries()].map(([id, m]) => ({
      id,
      target_type: m.target_type,
      target_id: m.target_id,
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
      const targetLabel = ex ? examTargetLabels[raw.exam_id] ?? ex.target_id : "";
      return {
        מקצוע: ex?.subject ?? "",
        תאריך_מבחן: ex?.exam_date ?? "",
        מורה: ex ? teacherNameCell(ex.teachers) : "",
        סוג_יעד: ex ? targetTypeHe[ex.target_type] ?? ex.target_type : "",
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
