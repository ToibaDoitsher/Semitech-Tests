"use client";

import Link from "next/link";
import useSWR from "swr";
import { useAcademicYear, withYearQuery, withYearTermQuery } from "@/components/academicYears/AcademicYearProvider";
import { ExamStudentStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NotesButton } from "@/components/ui/NotesButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { pickLookupName } from "@/lib/lookups/display";
import { psychologyLabel } from "@/lib/students/display";
import { teachingTrackTypeLabel } from "@/lib/students/fields";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import type { AssignmentCategory, ExamStudentStatus, Teacher, TeachingTrackType } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

export type ExamStudentLine = {
  id: string;
  status: ExamStudentStatus;
  student_id: string;
  notes?: string | null;
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

export type ExamStudentsExam = {
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

type ExamPayload = {
  exam: ExamStudentsExam;
  exam_students: ExamStudentLine[];
};

function countStatuses(lines: ExamStudentLine[]) {
  let took = 0;
  let forMakeup = 0;
  for (const l of lines) {
    if (l.status === "took") took += 1;
    if (l.status === "missing" || l.status === "makeup" || l.status === "pending") forMakeup += 1;
  }
  return { total: lines.length, took, forMakeup };
}

export function resolveStoredExamStatus(requested: ExamStudentStatus): ExamStudentStatus {
  return requested === "missing" ? "makeup" : requested;
}

export function useExamStudentsData(examId: string) {
  const { viewingYear, viewingTerm, readOnly } = useAcademicYear();
  const yearId = viewingYear?.id;
  const swr = useSWR<ExamPayload>(
    withYearTermQuery(`/api/exams/${examId}`, yearId, viewingTerm),
    fetcher,
  );
  return { ...swr, readOnly, yearId, viewingTerm };
}

export async function patchExamStudentStatus({
  lineId,
  requestedStatus,
  yearId,
}: {
  lineId: string;
  requestedStatus: ExamStudentStatus;
  yearId?: string;
}) {
  const r = await fetch(withYearQuery(`/api/exam-students/${lineId}`, yearId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: requestedStatus, force: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "עדכון נכשל");
  return j as {
    side_effects?: {
      deleted_makeups?: number;
      deleted_tracking?: number;
      unlocked_exam?: boolean;
    };
  };
}

type PanelProps = {
  examId: string;
  /** בחלון קופץ — כותרת קומפקטית */
  embedded?: boolean;
  /** להסתיר כותרת (כשהכותרת בדף האב) */
  showTitle?: boolean;
  onEditExam?: () => void;
};

export function ExamStudentsPanel({ examId, embedded, showTitle = true, onEditExam }: PanelProps) {
  const { data, error, isLoading, mutate, readOnly, yearId, viewingTerm } = useExamStudentsData(examId);

  async function setStatus(
    lineId: string,
    requestedStatus: ExamStudentStatus,
    currentStatus: ExamStudentStatus,
    studentLabel: string,
  ) {
    if (requestedStatus === currentStatus) return;

    const movingAwayFromMakeup =
      (currentStatus === "makeup" || currentStatus === "completed" || currentStatus === "missing") &&
      (requestedStatus === "took" || requestedStatus === "pending");
    if (movingAwayFromMakeup) {
      const ok = confirm(
        `לשנות את ${studentLabel} ל-"נבחנה במועד"?\n\n` +
          `פעולה זו תמחק לצמיתות את רשומת ההשלמה ואת רשומת המעקב.`,
      );
      if (!ok) return;
    }

    const storedStatus = resolveStoredExamStatus(requestedStatus);
    const previous = data;

    void mutate(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          exam_students: current.exam_students.map((line) =>
            line.id === lineId ? { ...line, status: storedStatus } : line,
          ),
        };
      },
      { revalidate: false },
    );

    try {
      const j = await patchExamStudentStatus({ lineId, requestedStatus, yearId });
      void mutate();
      const side = j.side_effects;
      if (side && (side.deleted_makeups || side.unlocked_exam)) {
        const parts: string[] = [];
        if (side.deleted_makeups) parts.push("נמחקה רשומת השלמה");
        if (side.deleted_tracking) parts.push("נמחקה רשומת מעקב");
        if (side.unlocked_exam) parts.push("המבחן נפתח שוב");
        if (parts.length) alert(parts.join(" · "));
      }
    } catch (e) {
      void mutate(previous, { revalidate: false });
      alert((e as Error).message);
    }
  }

  async function finishMakeups() {
    if (!confirm("ליצור רשומות השלמה לכל התלמידות שסומנו כלא נבחנות?")) return;
    const r = await fetch(withYearTermQuery(`/api/exams/${examId}/finish`, yearId, viewingTerm), { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "פעולה נכשלה");
      return;
    }
    await mutate();
    alert(`נוצרו/עודכנו ${(j as { created?: number }).created ?? 0} השלמות`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-10 text-zinc-600">
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
  const { total, took, forMakeup } = countStatuses(lines);
  const locked = Boolean(e.makeup_locked_at);

  return (
    <div className="space-y-4">
      <div className={embedded ? "space-y-1" : "space-y-2"}>
        {showTitle && !embedded ? (
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">מבחן · תלמידות</p>
        ) : null}
        {showTitle ? (
          <>
            <h2 className={embedded ? "text-lg font-semibold" : "text-2xl font-semibold"}>{e.subject}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatHebrewDateFromYmd(e.exam_date)} · {teacherEmbedDisplayName(e.teachers)} · יעד:{" "}
              {e.target_label ?? "—"}
            </p>
          </>
        ) : null}
        {embedded && onEditExam && !readOnly ? (
          <button
            type="button"
            onClick={onEditExam}
            className="mt-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-zinc-50"
          >
            עריכת פרטי מבחן
          </button>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void finishMakeups()}
            disabled={locked}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {locked ? "המבחן ננעל" : "סיום — יצירת השלמות"}
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-3">
        <div>
          <div className="text-xs font-medium text-zinc-500">סה״כ</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{total}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">נבחנו</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-800">{took}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">להשלמה</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-sky-900">{forMakeup}</div>
        </div>
      </div>

      {locked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          המבחן ננעל. לא ניתן לעדכן סטטוסים כאן — רק מכרטיס תלמידה.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <Table className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2 py-2">תלמידה</TableHead>
              <TableHead className="px-2 py-2">ת״ז</TableHead>
              <TableHead className="px-2 py-2">כיתה</TableHead>
              <TableHead className="px-2 py-2">מסלול</TableHead>
              <TableHead className="px-2 py-2" title="התמחות · התמחות נוספת">התמחות</TableHead>
              <TableHead className="px-2 py-2" title="פסיכולוגיה">פסיכ׳</TableHead>
              <TableHead className="px-2 py-2" title="סוג הוראה">הוראה</TableHead>
              <TableHead className="px-2 py-2">סטטוס</TableHead>
              <TableHead className="px-2 py-2">הערה</TableHead>
              <TableHead className="px-2 py-2">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length ? (
              lines.map((row) => {
                const st = row.students;
                const studentLabel = st ? `${st.first_name} ${st.last_name}`.trim() : "התלמידה";
                const isTook = row.status === "took";
                const isMakeupOpen = row.status === "makeup" || row.status === "missing";
                const isCompleted = row.status === "completed";
                const spec = st ? pickLookupName(st.specializations) : "—";
                const spec2 = st ? pickLookupName(st.secondary_specializations) : "—";
                const specLabel =
                  spec2 && spec2 !== "—"
                    ? spec && spec !== "—"
                      ? `${spec} · ${spec2}`
                      : spec2
                    : spec;
                const baseBtn =
                  "rounded border px-1.5 py-1 text-xs font-medium transition disabled:opacity-40";
                const activeRing = "ring-1 ring-offset-1";
                return (
                  <TableRow key={row.id}>
                    <TableCell className="truncate px-2 py-1.5 font-medium" title={studentLabel}>
                      {st ? `${st.last_name} ${st.first_name}` : "—"}
                    </TableCell>
                    <TableCell className="truncate px-2 py-1.5 font-mono text-xs" dir="ltr">
                      {st?.tz ?? "—"}
                    </TableCell>
                    <TableCell className="truncate px-2 py-1.5">{st ? pickLookupName(st.classes) : "—"}</TableCell>
                    <TableCell className="truncate px-2 py-1.5">{st ? pickLookupName(st.tracks) : "—"}</TableCell>
                    <TableCell className="truncate px-2 py-1.5" title={specLabel}>{specLabel}</TableCell>
                    <TableCell className="px-2 py-1.5">{st ? psychologyLabel(st.is_psychology) : "—"}</TableCell>
                    <TableCell className="truncate px-2 py-1.5">{st ? teachingTrackTypeLabel(st.teaching_track_type) : "—"}</TableCell>
                    <TableCell className="px-2 py-1.5">
                      <ExamStudentStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="max-w-0 truncate px-2 py-1.5 text-xs" title={row.notes?.trim() || undefined}>
                      {row.notes?.trim() ? row.notes : "—"}
                    </TableCell>
                    <TableCell className="px-1.5 py-1.5">
                      {!readOnly ? (
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={locked}
                            className={[
                              baseBtn,
                              "border-emerald-200 bg-emerald-50 text-emerald-900",
                              isTook ? `${activeRing} ring-emerald-400` : "",
                            ].join(" ")}
                            onClick={() => void setStatus(row.id, "took", row.status, studentLabel)}
                          >
                            נבחנה{isTook ? " ✓" : ""}
                          </button>
                          <button
                            type="button"
                            disabled={locked}
                            className={[
                              baseBtn,
                              "border-red-200 bg-red-50 text-red-900",
                              isMakeupOpen ? `${activeRing} ring-red-400` : "",
                            ].join(" ")}
                            onClick={() => void setStatus(row.id, "missing", row.status, studentLabel)}
                          >
                            לא{isMakeupOpen ? " ✓" : ""}
                          </button>
                          <button
                            type="button"
                            disabled={locked}
                            className={[
                              baseBtn,
                              "border-sky-200 bg-sky-50 text-sky-900",
                              isCompleted ? `${activeRing} ring-sky-400` : "",
                            ].join(" ")}
                            onClick={() => void setStatus(row.id, "completed", row.status, studentLabel)}
                          >
                            הושלמה{isCompleted ? " ✓" : ""}
                          </button>
                          <NotesButton
                            entity="exam-students"
                            id={row.id}
                            compact
                            iconOnly
                            label="הערה"
                            modalTitle={`הערה — ${studentLabel}`}
                            hasNote={Boolean(row.notes?.trim())}
                            onSaved={() => void mutate()}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">צפייה</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell className="py-8 text-center text-zinc-500" colSpan={10}>
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
            apiPath={withYearQuery(`/api/exams/${examId}/exam-students/clear-all`, yearId)}
            confirmHint="יימחקו כל שורות התלמידות במבחן זה."
            onCleared={() => void mutate()}
          />
        ) : null}
      </div>
    </div>
  );
}
