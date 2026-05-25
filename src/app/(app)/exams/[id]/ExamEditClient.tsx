"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { ExamEditDialog, type SaveSummary } from "@/components/exams/ExamEditDialog";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { ExamStudentStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { NotesButton } from "@/components/ui/NotesButton";
import { PrintButton } from "@/components/PrintButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { EXAM_HARD_DELETE_PHRASE } from "@/lib/exams/deleteExam";
import { pickLookupName } from "@/lib/lookups/display";
import { psychologyLabel } from "@/lib/students/display";
import { teachingTrackTypeLabel } from "@/lib/students/fields";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import type {
  AssignmentCategory,
  ExamStudentStatus,
  Teacher,
  TeachingTrackType,
} from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Line = {
  id: string;
  status: ExamStudentStatus;
  student_id: string;
  students: {
    first_name: string;
    last_name: string;
    tz: string;
    is_psychology?: boolean;
    teaching_track_type?: "full" | "short" | null;
    classes?: { name: string } | { name: string }[] | null;
    tracks?: { name: string } | { name: string }[] | null;
    specializations?: { name: string } | { name: string }[] | null;
    secondary_specializations?: { name: string } | { name: string }[] | null;
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
  teachers: Teacher | null;
};

type DeletePreview = {
  exam_students: number;
  makeup_exams: number;
  makeup_tracking: number;
  exam_tracking: number;
};

function countStatuses(lines: Line[]) {
  let took = 0;
  let forMakeup = 0;
  for (const l of lines) {
    if (l.status === "took") took += 1;
    if (l.status === "missing" || l.status === "makeup" || l.status === "pending") forMakeup += 1;
  }
  return { total: lines.length, took, forMakeup };
}

const lineStatusHe: Record<string, string> = {
  pending: "ממתין",
  took: "נבחנה במועד",
  missing: "לא נבחנה",
  makeup: "השלמה",
  completed: "הושלמה בהשלמה",
};

export function ExamEditClient({ id }: { id: string }) {
  const router = useRouter();
  const { viewingYear, readOnly } = useAcademicYear();
  const yearId = viewingYear?.id;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<{
    exam: Exam;
    exam_students: Line[];
    delete_preview?: DeletePreview;
  }>(
    withYearQuery(`/api/exams/${id}`, yearId),
    fetcher,
  );

  async function setStatus(lineId: string, status: ExamStudentStatus) {
    const r = await fetch(withYearQuery(`/api/exam-students/${lineId}`, yearId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "עדכון נכשל");
      return;
    }
    await mutate();
  }

  async function finishMakeups() {
    if (!confirm("ליצור רשומות השלמה לכל התלמידות שסומנו כלא נבחנות?")) return;
    const r = await fetch(withYearQuery(`/api/exams/${id}/finish`, yearId), { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "פעולה נכשלה");
      return;
    }
    await mutate();
    alert(`נוצרו/עודכנו ${(j as { created?: number }).created ?? 0} השלמות`);
  }

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
  const { total, took, forMakeup } = countStatuses(lines);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">עדכון מבחן</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {e.subject} · {formatHebrewDateFromYmd(e.exam_date)} · {teacherEmbedDisplayName(e.teachers)} · יעד:{" "}
            {e.target_label ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NotesButton entity="exams" id={id} />
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
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-700/40 dark:bg-sky-950/30 dark:text-sky-100"
            >
              <Pencil className="size-3.5" strokeWidth={2} />
              עריכת תאריך / יעד
            </button>
          ) : null}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => void finishMakeups()}
              disabled={locked}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
            >
              {locked ? "המבחן ננעל — השלמות נוצרו" : "סיום — יצירת השלמות"}
            </button>
          ) : null}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              מחק מבחן
            </button>
          ) : null}
          <Link href="/exams" className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800">
            חזרה
          </Link>
        </div>
      </div>

      {editOpen ? (
        <ExamEditDialog
          examId={id}
          locked={locked}
          onClose={() => setEditOpen(false)}
          onSaved={(summary: SaveSummary | null) => {
            setEditOpen(false);
            if (summary) {
              const parts: string[] = [];
              if (summary.added) parts.push(`נוספו ${summary.added} תלמידות`);
              if (summary.removedExamStudents) parts.push(`הוסרו ${summary.removedExamStudents}`);
              if (summary.removedMakeups) parts.push(`נמחקו ${summary.removedMakeups} השלמות`);
              if (summary.removedTracking) parts.push(`נמחקו ${summary.removedTracking} רשומות מעקב`);
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
          }}
        />
      ) : null}

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

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-zinc-500">סה״כ תלמידות</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{total}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">נבחנו במועד</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800">{took}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">להשלמה / ממתין</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-sky-900">{forMakeup}</div>
        </div>
      </div>

      {locked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          המבחן ננעל. לא ניתן לעדכן סטטוסים כאן — רק מכרטיס תלמידה.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/40">
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow>
              <TableHead>תלמידה</TableHead>
              <TableHead>ת״ז</TableHead>
              <TableHead>כיתה</TableHead>
              <TableHead>מסלול</TableHead>
              <TableHead>התמחות</TableHead>
              <TableHead>התמחות נוספת</TableHead>
              <TableHead>פסיכולוגיה</TableHead>
              <TableHead>סוג הוראה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length ? (
              lines.map((row) => {
                const st = row.students;
                return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {st ? (
                      <Link
                        href={`/students/${row.student_id}`}
                        className="text-sky-800 underline-offset-2 hover:underline dark:text-sky-300"
                      >
                        {st.last_name} {st.first_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-left font-mono text-xs" dir="ltr">
                    {st?.tz ?? "—"}
                  </TableCell>
                  <TableCell>{st ? pickLookupName(st.classes) : "—"}</TableCell>
                  <TableCell>{st ? pickLookupName(st.tracks) : "—"}</TableCell>
                  <TableCell>{st ? pickLookupName(st.specializations) : "—"}</TableCell>
                  <TableCell>{st ? pickLookupName(st.secondary_specializations) : "—"}</TableCell>
                  <TableCell>{st ? psychologyLabel(st.is_psychology) : "—"}</TableCell>
                  <TableCell>{st ? teachingTrackTypeLabel(st.teaching_track_type) : "—"}</TableCell>
                  <TableCell>
                    <ExamStudentStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    {!readOnly ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={locked}
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-40"
                          onClick={() => void setStatus(row.id, "took")}
                        >
                          נבחנה במועד
                        </button>
                        <button
                          type="button"
                          disabled={locked}
                          className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-40"
                          onClick={() => void setStatus(row.id, "missing")}
                        >
                          לא נבחנה
                        </button>
                        <button
                          type="button"
                          disabled={locked}
                          className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:opacity-40"
                          onClick={() => void setStatus(row.id, "completed")}
                        >
                          הושלמה בהשלמה
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">צפייה בלבד</span>
                    )}
                  </TableCell>
                </TableRow>
              );
              })
            ) : (
              <TableRow>
                <TableCell className="py-10 text-center text-zinc-500" colSpan={10}>
                  אין תלמידות במבחן
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {!readOnly ? (
          <TableClearFooter
            label="תלמידות במבחן"
            count={lines.length}
            apiPath={withYearQuery(`/api/exams/${id}/exam-students/clear-all`, yearId)}
            confirmHint="יימחקו כל שורות התלמידות במבחן זה וגם רשומות השלמה פתוחות/קשורות לאותו מבחן."
            onCleared={() => void mutate()}
          />
        ) : null}
      </div>
    </div>
  );
}
