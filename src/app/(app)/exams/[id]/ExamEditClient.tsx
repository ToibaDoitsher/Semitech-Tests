"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery, withYearTermQuery } from "@/components/academicYears/AcademicYearProvider";
import { ExamEditDialog, type SaveSummary } from "@/components/exams/ExamEditDialog";
import { ExamStudentsPanel } from "@/components/exams/ExamStudentsPanel";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { NotesButton } from "@/components/ui/NotesButton";
import { PrintButton } from "@/components/PrintButton";
import { EXAM_HARD_DELETE_PHRASE } from "@/lib/exams/deleteExam";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import type {
  AssignmentCategory,
  Teacher,
  TeachingTrackType,
} from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Line = {
  id: string;
  status: string;
  student_id: string;
  notes?: string | null;
  students: {
    first_name: string;
    last_name: string;
    tz: string;
  } | null;
};

type Exam = {
  id: string;
  subject: string;
  exam_date: string;
  target_label?: string;
  makeup_locked_at?: string | null;
  assignment_category: AssignmentCategory;
  grade_levels?: string[];
  class_ids?: string[];
  track_ids?: string[];
  specialization_ids?: string[];
  psychology_enabled?: boolean;
  applies_to_all_in_grade?: boolean;
  teaching_track_type?: TeachingTrackType | null;
  teacher_id?: string;
  teachers: Teacher | null;
};

type DeletePreview = {
  exam_students: number;
  makeup_exams: number;
  makeup_tracking: number;
  exam_tracking: number;
};

const lineStatusHe: Record<string, string> = {
  pending: "ממתין",
  took: "נבחנה במועד",
  missing: "לא נבחנה",
  makeup: "השלמה",
  completed: "הושלמה בהשלמה",
};

export function ExamEditClient({
  id,
  view = "students",
}: {
  id: string;
  view?: "students" | "edit";
}) {
  const router = useRouter();
  const { viewingYear, viewingTerm, readOnly } = useAcademicYear();
  const yearId = viewingYear?.id;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<{
    exam: Exam;
    exam_students: Line[];
    delete_preview?: DeletePreview;
  }>(
    withYearTermQuery(`/api/exams/${id}`, yearId, viewingTerm),
    fetcher,
  );

  async function deleteExam() {
    setDeleteBusy(true);
    try {
      const r = await fetch(withYearQuery(`/api/exams/${id}`, yearId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm_phrase: EXAM_HARD_DELETE_PHRASE }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert((j as { error?: string }).error ?? "מחיקה נכשלה");
        return;
      }
      router.push("/exams");
      router.refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-zinc-600">
        <Spinner />
        טוען…
      </div>
    );
  }
  if (error || !data?.exam) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">מבחן לא נמצא</div>;
  }

  const e = data.exam;
  const lines = data.exam_students ?? [];
  const preview = data.delete_preview;
  const locked = Boolean(e.makeup_locked_at);

  const deleteHint = preview
    ? [
        "מחיקה קשה — לא ניתן לשחזר.",
        "",
        "יימחקו לצמיתות:",
        `• ${preview.exam_students} שורות תלמידות במבחן`,
        preview.makeup_exams ? `• ${preview.makeup_exams} השלמות` : null,
        preview.makeup_tracking ? `• ${preview.makeup_tracking} רשומות מעקב השלמות` : null,
        preview.exam_tracking ? `• ${preview.exam_tracking} רשומות מעקב מורה` : null,
        "• המבחן עצמו וכל התיעוד שלו",
        "",
        locked ? "שימי לב: המבחן כבר ננעל והיו בו השלמות." : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "מחיקה קשה — כל הנתונים הקשורים למבחן יימחקו לצמיתות.";

  const examEditForm =
    !readOnly ? (
      <ExamEditDialog
        inline
        examId={id}
        locked={locked}
        onSaved={(summary: SaveSummary | null) => {
          if (summary) {
            const parts: string[] = [];
            if (summary.added) parts.push(`נוספו ${summary.added} תלמידות`);
            if (summary.removedExamStudents) parts.push(`הוסרו ${summary.removedExamStudents}`);
            if (summary.removedMakeups) parts.push(`נמחקו ${summary.removedMakeups} השלמות`);
            if (summary.removedTracking) parts.push(`נמחקו ${summary.removedTracking} רשומות מעקב`);
            const tc = summary.teacherCascade;
            if (tc) {
              if (tc.assignment_updated) parts.push("השיבוץ-המקור עודכן");
              if (tc.exams_updated) parts.push(`עודכנו ${tc.exams_updated} מבחנים אחים`);
              if (tc.snapshots_updated) parts.push(`עודכנו ${tc.snapshots_updated} שורות תלמידות`);
            }
            if (parts.length) alert(`המבחן עודכן: ${parts.join(" · ")}`);
          }
          void mutate();
        }}
        initial={{
          exam_date: e.exam_date,
          assignment_category: e.assignment_category,
          grade_levels: e.grade_levels ?? [],
          class_ids: e.class_ids ?? [],
          track_ids: e.track_ids ?? [],
          specialization_ids: e.specialization_ids ?? [],
          psychology_enabled: Boolean(e.psychology_enabled),
          applies_to_all_in_grade: Boolean(e.applies_to_all_in_grade),
          teaching_track_type: e.teaching_track_type ?? null,
          teacher_id: e.teacher_id ?? "",
        }}
      />
    ) : null;

  if (view === "edit") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">עריכת מבחן</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-zinc-50">{e.subject}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {formatHebrewDateFromYmd(e.exam_date)} · {teacherEmbedDisplayName(e.teachers)} · יעד:{" "}
              {e.target_label ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NotesButton entity="exams" id={id} label="הערות על המבחן" modalTitle="הערות על המבחן" />
            <Link
              href={`/exams/${id}`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              תלמידות במבחן
            </Link>
            <Link
              href="/exams"
              className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
            >
              חזרה לרשימה
            </Link>
          </div>
        </div>
        {readOnly ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            שנת לימודים בארכיון — צפייה בלבד, לא ניתן לערוך.
          </p>
        ) : (
          examEditForm
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">מבחן · תלמידות</p>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-zinc-50">{e.subject}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatHebrewDateFromYmd(e.exam_date)} · {teacherEmbedDisplayName(e.teachers)} · יעד:{" "}
            {e.target_label ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NotesButton entity="exams" id={id} label="הערות על המבחן" modalTitle="הערות על המבחן" />
          {!readOnly ? (
            <Link
              href={`/exams/${id}/edit`}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              עריכת מבחן
            </Link>
          ) : null}
          <PrintButton label="רשימת תלמידות" />
          <ExportExcelButton
            label="תלמידות במבחן לאקסל"
            filename={`תלמידות-מבחן-${e.exam_date}`}
            sheetName="תלמידות"
            getRows={async () =>
              lines.map((l) => ({
                שם_פרטי: l.students?.first_name ?? "",
                שם_משפחה: l.students?.last_name ?? "",
                תעודת_זהות: l.students?.tz ?? "",
                סטטוס: lineStatusHe[l.status] ?? l.status,
              }))
            }
          />
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              מחק מבחן
            </button>
          ) : null}
          <Link
            href="/exams"
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
          >
            חזרה לרשימה
          </Link>
        </div>
      </div>

      <ConfirmDangerDialog
        open={deleteOpen}
        onClose={() => !deleteBusy && setDeleteOpen(false)}
        title="מחיקת מבחן לצמיתות"
        description={`${e.subject} · ${formatHebrewDateFromYmd(e.exam_date)} — פעולה בלתי הפיכה.`}
        hint={deleteHint}
        requiredPhrase={EXAM_HARD_DELETE_PHRASE}
        confirmLabel="כן, מחק לצמיתות"
        busy={deleteBusy}
        onConfirm={() => deleteExam()}
      />

      <ExamStudentsPanel examId={id} showTitle={false} />
    </div>
  );
}
