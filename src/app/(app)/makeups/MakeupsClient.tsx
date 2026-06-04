"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Pencil, Undo2, UserRound } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { CompleteMakeupDialog } from "@/components/makeup/CompleteMakeupDialog";
import { ListDataCard, ListPageHeader, ListTableToolbar, LIST_ROW_LINK_CLASS } from "@/components/ui/ListPage";
import { ListFilterBar, matchesNameQuery } from "@/components/ui/ListFilterBar";
import { MakeupStatusBadge } from "@/components/ui/StatusBadge";
import { NotesButton } from "@/components/ui/NotesButton";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Row = {
  id: string;
  student_id: string;
  exam_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  grade: number | null;
  notes?: string | null;
  student: {
    first_name: string;
    last_name: string;
    tz: string;
    grade_level?: string | null;
  } | null;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

function formatCompleted(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MakeupsClient() {
  const { viewingYear, readOnly } = useAcademicYear();
  const yearId = viewingYear?.id;
  const { data, error, isLoading, mutate } = useSWR<{ makeups: Row[] }>(
    withYearQuery("/api/makeups", yearId),
    fetcher,
  );
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [editGradeId, setEditGradeId] = useState<string | null>(null);
  const [editGradeValue, setEditGradeValue] = useState("");
  const [editGradeBusy, setEditGradeBusy] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [gradeFilter, setGradeFilter] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);

  const allRows = data?.makeups ?? [];
  const filteredRows = useMemo(() => {
    return allRows.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (gradeFilter && (m.student?.grade_level ?? "") !== gradeFilter) return false;
      if (deferredSearch.trim()) {
        const matches = matchesNameQuery(deferredSearch, [
          m.student?.first_name,
          m.student?.last_name,
          m.student?.tz,
          m.exam?.subject,
          m.exam?.teacher_name,
        ]);
        if (!matches) return false;
      }
      return true;
    });
  }, [allRows, deferredSearch, statusFilter, gradeFilter]);

  const totalCount = allRows.length;
  const count = filteredRows.length;
  const isFiltering = Boolean(deferredSearch.trim() || statusFilter !== "open" || gradeFilter);

  async function completeSave(payload: { completed_at: string; notes: string }) {
    if (!completeId) return;
    setCompleteBusy(true);
    try {
      const r = await fetch(withYearQuery(`/api/makeups/${completeId}/complete`, yearId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "עדכון נכשל");
      setCompleteId(null);
      await mutate();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCompleteBusy(false);
    }
  }

  async function undoMakeup(row: Row) {
    const studentLabel = row.student
      ? `${row.student.first_name} ${row.student.last_name}`.trim()
      : "התלמידה";
    const examLabel = row.exam?.subject ?? "המבחן";
    const ok = confirm(
      `לבטל את ההשלמה של ${studentLabel} במבחן ${examLabel}?\n\n` +
        `פעולה זו תמחק לצמיתות את רשומת ההשלמה ואת רשומת המעקב, ` +
        `ותחזיר את הסטטוס במבחן ל"נבחנה במועד" (כאילו הסימון "לא נבחנה" לא היה).`,
    );
    if (!ok) return;
    const r = await fetch(withYearQuery(`/api/makeups/${row.id}/undo`, yearId), {
      method: "POST",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "ביטול נכשל");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="השלמות"
        subtitle="מבחנים חסרים — סימון השלמה מעדכן גם את סטטוס המבחן"
        actions={
          <ExportExcelButton
            label="ייצוא לאקסל (כל ההשלמות)"
            filename="השלמות"
            sheetName="השלמות"
            exportUrl={withYearQuery("/api/export/makeups", yearId)}
          />
        }
      />

      <ListDataCard>
        <ListFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchLabel="חיפוש השלמה"
          searchPlaceholder="למשל: יעל כהן · כהן יעל · ת״ז · מקצוע · שם מורה…"
          searchHint="חיפוש לפי שם תלמידה (פרטי + משפחה גם בסדר הפוך) · ת״ז · מקצוע · מורה"
          filters={[
            {
              id: "status",
              label: "סטטוס",
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: "open", label: "פתוח" },
                { value: "completed", label: "הושלם" },
              ],
            },
            {
              id: "grade",
              label: "שכבה",
              value: gradeFilter,
              onChange: setGradeFilter,
              options: [
                { value: "א", label: "א" },
                { value: "ב", label: "ב" },
                { value: "ג", label: "ג" },
              ],
            },
          ]}
          isAnyActive={isFiltering}
          onClearAll={() => {
            setSearchTerm("");
            setStatusFilter("open");
            setGradeFilter("");
          }}
        />
      </ListDataCard>

      <ListDataCard enterDelay={0.09}>
        <ListTableToolbar>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען…
            </span>
          ) : error ? (
            <span className="text-red-600">{(error as Error).message}</span>
          ) : (
            <span>
              {count} רשומות{isFiltering && count !== totalCount ? ` · מתוך ${totalCount}` : ""}
            </span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>תלמידה</TableHead>
              <TableHead>מבחן</TableHead>
              <TableHead>תאריך מבחן</TableHead>
              <TableHead>מורה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>ציון</TableHead>
              <TableHead>תאריך השלמה</TableHead>
              <TableHead>הערה</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length ? (
              filteredRows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.student ? `${m.student.last_name} ${m.student.first_name}` : "—"}
                  </TableCell>
                  <TableCell>{m.exam?.subject ?? "—"}</TableCell>
                  <TableCell>{m.exam?.exam_date ? formatHebrewDateFromYmd(m.exam.exam_date) : "—"}</TableCell>
                  <TableCell>{m.exam?.teacher_name ?? "—"}</TableCell>
                  <TableCell>
                    <MakeupStatusBadge status={m.status as "open" | "completed"} />
                  </TableCell>
                  <TableCell className="tabular-nums">{m.grade ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatCompleted(m.completed_at)}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {m.notes && m.notes.trim() ? (
                      <span
                        className="line-clamp-2 text-xs leading-snug text-amber-900 dark:text-amber-200"
                        title={m.notes}
                      >
                        {m.notes}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link
                        href={`/students/${m.student_id}`}
                        className={LIST_ROW_LINK_CLASS}
                      >
                        <UserRound className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                        כרטיס תלמידה
                      </Link>
                      <Link
                        href={`/exams/${m.exam_id}`}
                        className={LIST_ROW_LINK_CLASS}
                      >
                        <BookOpen className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                        למבחן
                      </Link>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                          onClick={() => {
                            setEditGradeId(m.id);
                            setEditGradeValue(m.grade != null ? String(m.grade) : "");
                          }}
                        >
                          <Pencil className="size-3.5 shrink-0" strokeWidth={2} />
                          ציון
                        </button>
                      ) : null}
                      {!readOnly && m.status === "open" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                          onClick={() => setCompleteId(m.id)}
                        >
                          <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2} />
                          הושלם
                        </button>
                      ) : null}
                      {!readOnly ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                          title="ביטול: התלמידה כן נבחנה במועד, סומנה בטעות. ימחק את ההשלמה ויחזיר את הסטטוס במבחן."
                          onClick={() => void undoMakeup(m)}
                        >
                          <Undo2 className="size-3.5 shrink-0" strokeWidth={2} />
                          ביטול
                        </button>
                      ) : null}
                      <NotesButton
                        entity="makeups"
                        id={m.id}
                        compact
                        label="הערה"
                        modalTitle={`הערה — ${m.student ? `${m.student.first_name} ${m.student.last_name}`.trim() : "השלמה"}`}
                        hasNote={Boolean(m.notes && m.notes.trim().length)}
                        onSaved={() => void mutate()}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="py-14 text-center text-zinc-500">
                  {isLoading ? "טוען…" : isFiltering ? "אין תוצאות תואמות לסינון" : "אין השלמות פתוחות"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {!readOnly ? (
          <TableClearFooter
            label="השלמות"
            count={totalCount}
            apiPath={withYearQuery("/api/makeups/clear-all", yearId)}
            onCleared={() => void mutate()}
          />
        ) : null}
      </ListDataCard>

      <CompleteMakeupDialog
        open={Boolean(completeId)}
        onClose={() => !completeBusy && setCompleteId(null)}
        busy={completeBusy}
        onSave={completeSave}
      />

      {editGradeId ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="סגירה"
            onClick={() => !editGradeBusy && setEditGradeId(null)}
          />
          <div className="relative z-[101] w-full max-w-xs rounded-xl border bg-white p-4 shadow-lg">
            <h3 className="font-semibold">עריכת ציון</h3>
            <input
              type="number"
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
              value={editGradeValue}
              onChange={(e) => setEditGradeValue(e.target.value)}
              disabled={editGradeBusy}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-sm"
                disabled={editGradeBusy}
                onClick={() => setEditGradeId(null)}
              >
                ביטול
              </button>
              <button
                type="button"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={editGradeBusy}
                onClick={async () => {
                  setEditGradeBusy(true);
                  try {
                    const r = await fetch(withYearQuery(`/api/makeups/${editGradeId}`, yearId), {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        grade: editGradeValue.trim() ? Number(editGradeValue) : null,
                      }),
                    });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
                    setEditGradeId(null);
                    await mutate();
                  } catch (e) {
                    alert((e as Error).message);
                  } finally {
                    setEditGradeBusy(false);
                  }
                }}
              >
                {editGradeBusy ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
