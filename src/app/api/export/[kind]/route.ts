import { NextResponse } from "next/server";
import { enrichStudentsWithGrade, formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import {
  formatGradeLevelsLabel,
  multiTargetTypeLabel,
  rowToMultiTarget,
} from "@/lib/assignments/multiTarget";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { asStudentRows, type StudentWithLookupsRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import { pickLookupName } from "@/lib/lookups/display";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherDisplayName, teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { examTrackingDueDate, formatTrackingDateTime } from "@/lib/tracking/dates";

function namesByIdMap(
  rows: { id: string; name: string }[] | null | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows ?? []) m.set(r.id, r.name);
  return m;
}

function joinNames(ids: string[], byId: Map<string, string>): string {
  return ids
    .map((id) => byId.get(id) ?? "")
    .filter(Boolean)
    .join(", ");
}

import { teachingModeSelectionLabel } from "@/lib/teachers/display";

function teachingModeForExport(mode: string | null | undefined): string {
  return teachingModeSelectionLabel(mode);
}

function hebrewYmd(ymd: string | null | undefined): string {
  if (!ymd) return "";
  return formatHebrewDateFromYmd(ymd);
}

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
  grade_levels?: string[];
  class_ids?: string[];
  track_ids?: string[];
  specialization_ids?: string[];
  psychology_enabled: boolean;
  applies_to_all_in_grade?: boolean;
  assignment_category?: "חובה" | "התמחות";
  teachers: unknown;
};

function examTargetRow(e: ExamJoin) {
  return { id: e.id, ...rowToMultiTarget(e), assignment_category: e.assignment_category };
}

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
        שכבה: s.year_label ?? formatCohortGradeLabel(s.grade_level),
        כיתה: pickLookupName(s.classes),
        התמחות: pickLookupName(s.specializations),
        התמחות_נוספת: pickLookupName(s.secondary_specializations),
        מסלול: pickLookupName(s.tracks),
        פסיכולוגיה: s.is_psychology ? "כן" : "לא",
        סוג_הוראה:
          s.teaching_track_type === "full"
            ? "מלא"
            : s.teaching_track_type === "short"
              ? "מקוצר"
              : "",
        הערות: (s.notes ?? "").trim(),
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
          .select("id, subject, exam_date, grade_levels, class_ids, track_ids, specialization_ids, psychology_enabled, applies_to_all_in_grade, assignment_category, teachers ( id, first_name, last_name, full_name_generated )")
          .eq("academic_year_id", scope.year.id)
          .order("exam_date", { ascending: false })
          .range(from, to),
      );
      const exams = data as ExamJoin[];
      const labels = await resolveExamTargetLabels(supabase, exams.map(examTargetRow));
      const rows = exams.map((e) => {
        const mt = rowToMultiTarget(e);
        return {
          מקצוע: e.subject,
          תאריך: hebrewYmd(e.exam_date),
          מורה: teacherNameCell(e.teachers),
          שכבות: formatGradeLevelsLabel(mt.grade_levels),
          סוג_יעד: multiTargetTypeLabel(mt, e.assignment_category),
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
      })[];

      const classIds = new Set<string>();
      const specIds = new Set<string>();
      const trackIds = new Set<string>();
      for (const a of raw) {
        const mt = rowToMultiTarget(a);
        mt.class_ids.forEach((id) => classIds.add(id));
        mt.specialization_ids.forEach((id) => specIds.add(id));
        mt.track_ids.forEach((id) => trackIds.add(id));
      }
      const [classesRes, specsRes, tracksRes] = await Promise.all([
        classIds.size
          ? supabase.from("classes").select("id,name").in("id", [...classIds])
          : Promise.resolve({ data: [] }),
        specIds.size
          ? supabase.from("specializations").select("id,name").in("id", [...specIds])
          : Promise.resolve({ data: [] }),
        trackIds.size
          ? supabase.from("tracks").select("id,name").in("id", [...trackIds])
          : Promise.resolve({ data: [] }),
      ]);
      const classByIdName = namesByIdMap(classesRes.data as { id: string; name: string }[]);
      const specByIdName = namesByIdMap(specsRes.data as { id: string; name: string }[]);
      const trackByIdName = namesByIdMap(tracksRes.data as { id: string; name: string }[]);

      const rows = raw.map((a) => {
        const row = a as typeof a & { assignment_category?: "חובה" | "התמחות" };
        const mt = rowToMultiTarget(a);
        const teacher = unwrapOne(a.teachers as unknown as
          | { first_name?: string; last_name?: string }
          | { first_name?: string; last_name?: string }[]
          | null);
        const classCell = mt.applies_to_all_in_grade
          ? "כל השכבה"
          : joinNames(mt.class_ids, classByIdName);
        return {
          "שם פרטי מורה": teacher?.first_name ?? "",
          "שם משפחה מורה": teacher?.last_name ?? "",
          מקצוע: a.subject ?? "",
          "שם שיעור": a.lesson_name ?? "",
          שכבה: mt.grade_levels.join(", "),
          "סוג שיבוץ": row.assignment_category ?? "",
          כיתה: classCell,
          התמחות: joinNames(mt.specialization_ids, specByIdName),
          מסלול: joinNames(mt.track_ids, trackByIdName),
          פסיכולוגיה: mt.psychology_enabled ? "כן" : "לא",
          "סוג הוראה": teachingModeForExport(a.teaching_mode),
        };
      });
      return NextResponse.json({ rows });
    }

    if (kind === "makeups") {
      let data: Awaited<ReturnType<typeof paginateSelect>>;
      try {
        data = await paginateSelect((from, to) =>
          supabase
            .from("makeup_exams")
            .select(
              "id, status, created_at, completed_at, student_id, exam_id, auto_registered, starting_grade, is_paid",
            )
            .order("created_at", { ascending: false })
            .range(from, to),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/starting_grade|is_paid/i.test(msg)) {
          data = await paginateSelect((from, to) =>
            supabase
              .from("makeup_exams")
              .select(
                "id, status, created_at, completed_at, student_id, exam_id, auto_registered",
              )
              .order("created_at", { ascending: false })
              .range(from, to),
          );
        } else if (/auto_registered/i.test(msg)) {
          data = await paginateSelect((from, to) =>
            supabase
              .from("makeup_exams")
              .select("id, status, created_at, completed_at, student_id, exam_id")
              .order("created_at", { ascending: false })
              .range(from, to),
          );
        } else {
          throw err;
        }
      }
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
          auto_registered?: boolean;
          starting_grade?: number | null;
          is_paid?: boolean;
        };
        const st = studentsBy[row.student_id];
        const ex = examsBy[row.exam_id];
        return {
          סטטוס: makeupStatusHe[row.status] ?? row.status,
          נרשמה_להשלמה: row.auto_registered ? "כן" : "לא",
          תאריך_השלמה: row.completed_at ? hebrewYmd(row.completed_at.slice(0, 10)) : "",
          ציון_התחלה: row.starting_grade ?? "",
          בתשלום: row.is_paid ? "כן" : "לא",
          נוצר: row.created_at?.slice(0, 19) ?? "",
          שם_פרטי: st?.first_name ?? "",
          שם_משפחה: st?.last_name ?? "",
          תעודת_זהות: st?.tz ?? "",
          מקצוע: ex?.subject ?? "",
          תאריך_מבחן: hebrewYmd(ex?.exam_date),
          מורה: ex ? teacherNameCell(ex.teachers) : "",
        };
      });
      return NextResponse.json({ rows });
    }

    if (kind === "tracking") {
      let data: Awaited<ReturnType<typeof paginateSelect>>;
      try {
        data = await paginateSelect((from, to) =>
          supabase
            .from("exam_tracking")
            .select(
              "id, submitted_exam, student_submission_date, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id",
            )
            .order("id", { ascending: false })
            .range(from, to),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/student_submission_date/i.test(msg)) {
          data = await paginateSelect((from, to) =>
            supabase
              .from("exam_tracking")
              .select(
                "id, submitted_exam, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id",
              )
              .order("id", { ascending: false })
              .range(from, to),
          );
        } else {
          throw err;
        }
      }
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
          student_submission_date?: string | null;
          approved_by_coordinator: boolean;
          sent_for_review: boolean;
          grades_submitted: boolean;
          grades_approved: boolean;
          transferred_to_system: boolean;
          exam_id: string;
        };
        const ex = examsBy[row.exam_id];
        const examDate = ex?.exam_date ?? "";
        const submissionDate = row.student_submission_date
          ? row.student_submission_date.slice(0, 10)
          : "";
        const gradesBase = submissionDate || examDate;
        return {
          מקצוע: ex?.subject ?? "",
          הגשת_המבחן: examTrackingDueDate(examDate, -7),
          תאריך: hebrewYmd(examDate),
          הגשת_מטלה_תלמידות: submissionDate ? hebrewYmd(submissionDate) : "",
          הגשת_ציונים: examTrackingDueDate(gradesBase, 7),
          הגשת_ציונים_מקור: submissionDate ? "הגשת מטלה" : "תאריך מבחן",
          מורה: ex ? teacherNameCell(ex.teachers) : "",
          הוגש_מבחן: row.submitted_exam ? formatTrackingDateTime(row.submitted_exam) : "",
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
          exams ( id, subject, exam_date, grade_levels, class_ids, track_ids, specialization_ids, psychology_enabled, applies_to_all_in_grade, assignment_category, ${TEACHER_EMBED_IN_EXAM} )
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
    const labelInputs = [...examMeta.entries()].map(([id, m]) => examTargetRow({ ...m, id }));
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
        תאריך_מבחן: hebrewYmd(ex?.exam_date),
        מורה: ex ? teacherNameCell(ex.teachers) : "",
        סוג_יעד: ex ? multiTargetTypeLabel(rowToMultiTarget(ex), ex.assignment_category) : "",
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
