import { NextResponse } from "next/server";
import {
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { notDeleted } from "@/lib/db/softDelete";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import {
  EXAM_SUBMISSION_DUE_OFFSET,
  GRADES_SUBMISSION_DUE_OFFSET,
} from "@/lib/tracking/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/* ─────────────── טיפוסי ההתראות ─────────────── */

export type NotificationSeverity = "urgent" | "warning" | "info";

export type NotificationType =
  | "exam_today"
  | "exam_tomorrow"
  | "exam_upcoming"
  | "submission_overdue"
  | "grades_overdue"
  | "grades_not_transferred"
  | "makeup_open_overdue"
  | "makeup_sent_no_grade";

export type Notification = {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href: string;
  icon: "calendar" | "alert" | "clock" | "file" | "send" | "check";
  sortDate: string; // YYYY-MM-DD לסידור: ככל שמוקדם יותר → דחוף יותר
  /** מזהה ישות לדה-דופ — אם 2 התראות חולקות אותו מזהה, יישאר רק הכי דחוף עם רמז למספר */
  entityKey: string;
  /** תוסף אופציונלי לכותרת אחרי איחוד התראות, למשל "(+2 נושאים)" */
  extraCount?: number;
};

/* ─────────────── עזרי תאריך ─────────────── */

function todayLocalYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(ymd: string, offset: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00`).getTime();
  const b = new Date(`${toYmd}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  urgent: 0,
  warning: 1,
  info: 2,
};

/* ─────────────── GET ─────────────── */

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );

  // בארכיון — אין התראות (נתונים סגורים)
  if (scope.readOnly) {
    return NextResponse.json({
      items: [],
      counts: { urgent: 0, warning: 0, info: 0, total: 0 },
      generated_at: new Date().toISOString(),
      read_only: true,
    });
  }

  const yearId = scope.year.id;
  const today = todayLocalYmd();
  const tomorrow = addDays(today, 1);
  const trackingWindowStart = addDays(today, -90); // נסתכל גם 90 יום אחורה למצוא איחורים
  const trackingWindowEnd = addDays(today, 14); // וגם שבועיים קדימה (יעדי הגשה מקדימים)
  const submissionWindowStart = addDays(today, EXAM_SUBMISSION_DUE_OFFSET); // לפני 7 ימים
  const gradesDeadlineLatest = addDays(today, -GRADES_SUBMISSION_DUE_OFFSET); // מבחנים שתאריך + 7 < היום

  /* ── שלב 1: שליפת מבחנים רלוונטיים בחלון תאריכים ── */

  const { data: relevantExamsRaw, error: relevantExamsErr } = await notDeleted(
    supabase
      .from("exams")
      .select(
        "id, subject, exam_date, teacher_id, teachers ( id, first_name, last_name, full_name_generated )",
      ),
  )
    .eq("academic_year_id", yearId)
    .gte("exam_date", trackingWindowStart)
    .lte("exam_date", trackingWindowEnd)
    .order("exam_date", { ascending: true })
    .limit(500);

  if (relevantExamsErr) {
    console.error("[GET /api/notifications] exams error:", relevantExamsErr.message);
  }

  const allExams = (relevantExamsRaw ?? []) as Array<{
    id: string;
    subject: string;
    exam_date: string;
    teachers: unknown;
  }>;
  const examsById = new Map(allExams.map((e) => [e.id, e]));
  const upcomingExams = allExams
    .filter((e) => e.exam_date >= today && e.exam_date <= addDays(today, 7))
    .slice(0, 50);
  const examIds = allExams.map((e) => e.id);

  /* ── שלב 2: מעקב / השלמות / מעקב השלמות במקביל ── */

  const trackingSelect =
    "id, exam_id, submitted_exam, student_submission_date, grades_submitted, grades_approved, transferred_to_system";
  const trackingSelectLegacy =
    "id, exam_id, submitted_exam, grades_submitted, grades_approved, transferred_to_system";
  const trackingQ = examIds.length
    ? (async () => {
        const first = await notDeleted(
          supabase.from("exam_tracking").select(trackingSelect),
        )
          .eq("academic_year_id", yearId)
          .in("exam_id", examIds)
          .limit(500);
        if (first.error && /student_submission_date/i.test(first.error.message)) {
          return await notDeleted(
            supabase.from("exam_tracking").select(trackingSelectLegacy),
          )
            .eq("academic_year_id", yearId)
            .in("exam_id", examIds)
            .limit(500);
        }
        return first;
      })()
    : Promise.resolve({ data: [], error: null });

  const openMakeupsQ = notDeleted(
    supabase
      .from("makeup_exams")
      .select(
        "id, status, created_at, student_id, exam_id, students ( id, first_name, last_name ), exams ( id, subject, exam_date )",
      ),
  )
    .eq("academic_year_id", yearId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(200);

  const makeupTrackingQ = supabase
    .from("makeup_tracking")
    .select(
      "id, exam_id, student_id, sent_to_teacher_at, grade_received_at, exams ( id, subject, exam_date ), students ( id, first_name, last_name )",
    )
    .eq("academic_year_id", yearId)
    .not("sent_to_teacher_at", "is", null)
    .is("grade_received_at", null)
    .limit(200);

  const [
    { data: trackingRaw, error: trackingErr },
    { data: openMakeups, error: openMakeupsErr },
    { data: makeupTracking, error: makeupTrackingErr },
  ] = await Promise.all([trackingQ, openMakeupsQ, makeupTrackingQ]);

  for (const [name, err] of [
    ["tracking", trackingErr],
    ["open makeups", openMakeupsErr],
    ["makeup tracking", makeupTrackingErr],
  ] as const) {
    if (err) console.error(`[GET /api/notifications] ${name} error:`, err.message);
  }

  // הרכבה: לכל tracking — מצרפים את פרטי המבחן מ-examsById
  type TrackingWithExam = {
    exam_id: string;
    submitted_exam: string | null;
    student_submission_date: string | null;
    grades_submitted: boolean;
    grades_approved: boolean;
    transferred_to_system: boolean;
    exams: { id: string; subject: string; exam_date: string; teachers: unknown } | null;
  };
  const tracking: TrackingWithExam[] = (trackingRaw ?? []).map((row) => {
    const t = row as {
      exam_id: string;
      submitted_exam: string | null;
      student_submission_date?: string | null;
      grades_submitted: boolean;
      grades_approved: boolean;
      transferred_to_system: boolean;
    };
    const e = examsById.get(t.exam_id) ?? null;
    return {
      exam_id: t.exam_id,
      submitted_exam: t.submitted_exam,
      student_submission_date: t.student_submission_date ?? null,
      grades_submitted: t.grades_submitted,
      grades_approved: t.grades_approved,
      transferred_to_system: t.transferred_to_system,
      exams: e ? { id: e.id, subject: e.subject, exam_date: e.exam_date, teachers: e.teachers } : null,
    };
  });

  const items: Notification[] = [];

  /* ── מבחני היום + מחר + עתידיים ── */
  for (const e of upcomingExams) {
    const teacher = teacherEmbedDisplayName(
      e.teachers as Parameters<typeof teacherEmbedDisplayName>[0],
    );
    const subj = e.subject ?? "מבחן";
    const hebDate = formatHebrewDateFromYmd(e.exam_date);

    if (e.exam_date === today) {
      items.push({
        id: `exam-today-${e.id}`,
        type: "exam_today",
        severity: "warning",
        title: `מבחן היום: ${subj}`,
        body: `${teacher || "מורה לא ידועה"} · ${hebDate}`,
        href: `/exams/${e.id}`,
        icon: "calendar",
        sortDate: e.exam_date,
        entityKey: `exam:${e.id}`,
      });
    } else if (e.exam_date === tomorrow) {
      items.push({
        id: `exam-tomorrow-${e.id}`,
        type: "exam_tomorrow",
        severity: "info",
        title: `מבחן מחר: ${subj}`,
        body: `${teacher || "מורה לא ידועה"} · ${hebDate}`,
        href: `/exams/${e.id}`,
        icon: "calendar",
        sortDate: e.exam_date,
        entityKey: `exam:${e.id}`,
      });
    } else {
      const days = daysBetween(today, e.exam_date);
      items.push({
        id: `exam-upcoming-${e.id}`,
        type: "exam_upcoming",
        severity: "info",
        title: `בעוד ${days} ימים: ${subj}`,
        body: `${teacher || "מורה לא ידועה"} · ${hebDate}`,
        href: `/exams/${e.id}`,
        icon: "calendar",
        sortDate: e.exam_date,
        entityKey: `exam:${e.id}`,
      });
    }
  }

  /* ── מעקב מבחנים: הגשה / ציונים / העברה ── */
  for (const t of tracking) {
    const e = t.exams;
    if (!e?.id || !e.exam_date) continue;
    const teacher = teacherEmbedDisplayName(
      e.teachers as Parameters<typeof teacherEmbedDisplayName>[0],
    );
    const subj = e.subject ?? "מבחן";
    const hebDate = formatHebrewDateFromYmd(e.exam_date);

    // הגשת מבחן: יעד הגשה = exam_date − 7. אם היום אחרי יעד ההגשה ועדיין לא הוגש
    if (!t.submitted_exam) {
      const submissionDue = addDays(e.exam_date, EXAM_SUBMISSION_DUE_OFFSET);
      if (today >= submissionDue && e.exam_date >= submissionWindowStart) {
        const overdue = daysBetween(submissionDue, today);
        const severity: NotificationSeverity = e.exam_date < today ? "urgent" : "warning";
        items.push({
          id: `submission-overdue-${e.id}`,
          type: "submission_overdue",
          severity,
          title:
            severity === "urgent"
              ? `המורה לא הגישה: ${subj}`
              : `יעד הגשת מבחן הגיע: ${subj}`,
          body: `${teacher || "מורה לא ידועה"} · המבחן ב-${hebDate}${overdue > 0 ? ` · באיחור של ${overdue} ימים` : ""}`,
          href: `/tracking`,
          icon: "alert",
          sortDate: submissionDue,
          entityKey: `exam:${e.id}`,
        });
      }
    }

    // ציונים: יעד = (תאריך הגשת מטלה אם מולא, אחרת תאריך מבחן) + 7. רק למבחנים שעברו.
    const gradesBaseDate = t.student_submission_date
      ? t.student_submission_date.slice(0, 10)
      : e.exam_date;
    if (gradesBaseDate <= today && !t.grades_submitted) {
      const gradesDue = addDays(gradesBaseDate, GRADES_SUBMISSION_DUE_OFFSET);
      if (today >= gradesDue) {
        const overdue = daysBetween(gradesDue, today);
        items.push({
          id: `grades-overdue-${e.id}`,
          type: "grades_overdue",
          severity: "urgent",
          title: `ציונים באיחור: ${subj}`,
          body: `${teacher || "מורה לא ידועה"} · יעד היה ${formatHebrewDateFromYmd(gradesDue)} · ${overdue} ימים`,
          href: `/tracking`,
          icon: "alert",
          sortDate: gradesDue,
          entityKey: `exam:${e.id}`,
        });
      } else if (today >= addDays(gradesDue, -3)) {
        items.push({
          id: `grades-upcoming-${e.id}`,
          type: "grades_overdue",
          severity: "warning",
          title: `יעד ציונים מתקרב: ${subj}`,
          body: `${teacher || "מורה לא ידועה"} · יעד ${formatHebrewDateFromYmd(gradesDue)}`,
          href: `/tracking`,
          icon: "clock",
          sortDate: gradesDue,
          entityKey: `exam:${e.id}`,
        });
      }
    }

    // הועבר למערכת: ציונים הוגשו אבל לא הועברו, ועברו 7 ימים נוספים אחרי יעד הציונים
    if (
      e.exam_date <= gradesDeadlineLatest &&
      t.grades_submitted &&
      !t.transferred_to_system
    ) {
      items.push({
        id: `grades-not-transferred-${e.id}`,
        type: "grades_not_transferred",
        severity: "warning",
        title: `טרם הועבר למערכת: ${subj}`,
        body: `${teacher || "מורה לא ידועה"} · ${hebDate}`,
        href: `/tracking`,
        icon: "file",
        sortDate: e.exam_date,
        entityKey: `exam:${e.id}`,
      });
    }
  }

  /* ── השלמות פתוחות ותיקות ── */
  for (const row of openMakeups ?? []) {
    const m = row as {
      id: string;
      created_at: string;
      student_id: string;
      exam_id: string;
      students: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      exams: { id: string; subject: string; exam_date: string } | { id: string; subject: string; exam_date: string }[] | null;
    };
    const stRaw = Array.isArray(m.students) ? m.students[0] : m.students;
    const exRaw = Array.isArray(m.exams) ? m.exams[0] : m.exams;
    if (!stRaw || !exRaw) continue;

    const createdYmd = m.created_at.slice(0, 10);
    const days = daysBetween(createdYmd, today);
    if (days < 14) continue;

    const studentLabel = `${stRaw.first_name} ${stRaw.last_name}`.trim() || "תלמידה";
    const subj = exRaw.subject ?? "מבחן";
    items.push({
      id: `makeup-open-${m.id}`,
      type: "makeup_open_overdue",
      severity: days >= 30 ? "urgent" : "warning",
      title: `השלמה פתוחה ${days} ימים: ${studentLabel}`,
      body: `${subj} · המבחן היה ב-${formatHebrewDateFromYmd(exRaw.exam_date)}`,
      href: `/makeups`,
      icon: "clock",
      sortDate: createdYmd,
      // לפי תלמידה+מבחן — כך גם "פתוחה ותיקה" וגם "נשלחה ולא חזר ציון" יתאחדו
      entityKey: `student-exam:${m.student_id}:${m.exam_id}`,
    });
  }

  /* ── מעקב השלמות: נשלח למורה ולא חזר ציון ── */
  for (const row of makeupTracking ?? []) {
    const mt = row as {
      id: string;
      sent_to_teacher_at: string;
      student_id: string;
      exam_id: string;
      students: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      exams: { id: string; subject: string; exam_date: string } | { id: string; subject: string; exam_date: string }[] | null;
    };
    const stRaw = Array.isArray(mt.students) ? mt.students[0] : mt.students;
    const exRaw = Array.isArray(mt.exams) ? mt.exams[0] : mt.exams;
    if (!stRaw || !exRaw) continue;

    const sentYmd = mt.sent_to_teacher_at.slice(0, 10);
    const days = daysBetween(sentYmd, today);
    if (days < 7) continue;

    const studentLabel = `${stRaw.first_name} ${stRaw.last_name}`.trim() || "תלמידה";
    const subj = exRaw.subject ?? "מבחן";
    items.push({
      id: `makeup-sent-${mt.id}`,
      type: "makeup_sent_no_grade",
      severity: days >= 21 ? "warning" : "info",
      title: `השלמה נשלחה למורה ${days} ימים: ${studentLabel}`,
      body: `${subj} · ממתין לציון`,
      href: `/makeups`,
      icon: "send",
      sortDate: sentYmd,
      entityKey: `student-exam:${mt.student_id}:${mt.exam_id}`,
    });
  }

  /* ── דה-דופ: התראה אחת לישות (לפי entityKey) ── */
  // לכל ישות שומרים את ההתראה הכי דחופה (urgent < warning < info, ולשבירת שוויון — sortDate מוקדם יותר).
  // אם היו עוד התראות על אותה ישות — מוסיפים extraCount כדי שה-UI יוכל להציג רמז.
  const byEntity = new Map<string, { primary: Notification; count: number }>();
  for (const it of items) {
    const existing = byEntity.get(it.entityKey);
    if (!existing) {
      byEntity.set(it.entityKey, { primary: it, count: 1 });
      continue;
    }
    const cmp = SEVERITY_RANK[it.severity] - SEVERITY_RANK[existing.primary.severity];
    const isMoreSevere =
      cmp < 0 || (cmp === 0 && it.sortDate < existing.primary.sortDate);
    byEntity.set(it.entityKey, {
      primary: isMoreSevere ? it : existing.primary,
      count: existing.count + 1,
    });
  }

  const dedupedItems: Notification[] = [];
  for (const { primary, count } of byEntity.values()) {
    if (count > 1) {
      dedupedItems.push({ ...primary, extraCount: count - 1 });
    } else {
      dedupedItems.push(primary);
    }
  }

  /* ── מיון לפי חומרה ואז לפי תאריך ── */
  dedupedItems.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return a.sortDate.localeCompare(b.sortDate);
  });

  const counts = {
    urgent: dedupedItems.filter((it) => it.severity === "urgent").length,
    warning: dedupedItems.filter((it) => it.severity === "warning").length,
    info: dedupedItems.filter((it) => it.severity === "info").length,
    total: dedupedItems.length,
  };

  return NextResponse.json({
    items: dedupedItems,
    counts,
    generated_at: new Date().toISOString(),
    read_only: false,
  });
}
