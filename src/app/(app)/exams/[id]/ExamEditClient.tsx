"use client";

import Link from "next/link";
import useSWR from "swr";
import { ExamStudentStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { NotesButton } from "@/components/ui/NotesButton";
import { PrintButton } from "@/components/PrintButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import type { ExamStudentStatus, Teacher } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Line = {
  id: string;
  status: ExamStudentStatus;
  student_id: string;
  students: { first_name: string; last_name: string; tz: string } | null;
};

type Exam = {
  id: string;
  subject: string;
  exam_date: string;
  target_label?: string;
  makeup_locked_at?: string | null;
  teachers: Teacher | null;
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
  const { data, error, isLoading, mutate } = useSWR<{ exam: Exam; exam_students: Line[] }>(
    `/api/exams/${id}`,
    fetcher,
  );

  async function setStatus(lineId: string, status: ExamStudentStatus) {
    const r = await fetch(`/api/exam-students/${lineId}`, {
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
    const r = await fetch(`/api/exams/${id}/finish`, { method: "POST" });
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
  const { total, took, forMakeup } = countStatuses(lines);
  const locked = Boolean(e.makeup_locked_at);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">עדכון מבחן</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {e.subject} · {e.exam_date} · {teacherEmbedDisplayName(e.teachers)} · יעד:{" "}
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
          <button
            type="button"
            onClick={() => void finishMakeups()}
            disabled={locked}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
          >
            {locked ? "המבחן ננעל — השלמות נוצרו" : "סיום — יצירת השלמות"}
          </button>
          <Link href="/exams" className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800">
            חזרה
          </Link>
        </div>
      </div>

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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תלמידה</TableHead>
              <TableHead>ת״ז</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length ? (
              lines.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.students ? `${row.students.last_name} ${row.students.first_name}` : "—"}
                  </TableCell>
                  <TableCell className="text-left font-mono text-xs" dir="ltr">
                    {row.students?.tz ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ExamStudentStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-10 text-center text-zinc-500" colSpan={4}>
                  אין תלמידות במבחן
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="תלמידות במבחן"
          count={lines.length}
          apiPath={`/api/exams/${id}/exam-students/clear-all`}
          confirmHint="יימחקו כל שורות התלמידות במבחן זה וגם רשומות השלמה פתוחות/קשורות לאותו מבחן."
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}
