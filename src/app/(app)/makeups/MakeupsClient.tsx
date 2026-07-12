"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Pencil, Undo2, UserRound } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery, withYearTermQuery } from "@/components/academicYears/AcademicYearProvider";
import { ExamWorkspaceModal } from "@/components/exams/ExamWorkspaceModal";
import { CompleteMakeupDialog } from "@/components/makeup/CompleteMakeupDialog";
import {
  RegisterForMakeupDialog,
  type RegisterForMakeupPayload,
} from "@/components/makeup/RegisterForMakeupDialog";
import { ListDataCard, ListPageHeader, ListTableToolbar, LIST_ROW_LINK_CLASS } from "@/components/ui/ListPage";
import { ListFilterBar, matchesNameQuery } from "@/components/ui/ListFilterBar";
import { MakeupStatusBadge } from "@/components/ui/StatusBadge";
import { NotesButton } from "@/components/ui/NotesButton";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import {
  buildMakeupsLabelsPrintHtml,
  buildMakeupsListPrintHtml,
  MAKEUPS_LABELS_PRINT_CSS,
  MAKEUPS_LIST_PRINT_CSS,
  type MakeupListPrintRow,
  type MakeupPrintRow,
} from "@/lib/export/makeupsPrint";
import { escapePrintText, openPrintDocument } from "@/lib/export/printClient";
import {
  combinedMakeupDisplayNotes,
  hasAnyMakeupDisplayNote,
} from "@/lib/makeups/combinedNotes";
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
  auto_registered: boolean;
  starting_grade: number | null;
  is_paid: boolean;
  student: {
    first_name: string;
    last_name: string;
    tz: string;
    grade_level?: string | null;
  } | null;
  exam: { subject: string; exam_date: string; teacher_name: string | null; notes?: string | null } | null;
  exam_student_notes?: string | null;
};

function RegisteredForMakeupCell({
  value,
  readOnly,
  busy,
  onToggle,
}: {
  value: boolean;
  readOnly: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const label = value ? "כן" : "לא";
  const badgeClass = value
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : "border-slate-200 bg-slate-50 text-slate-600";

  if (readOnly) {
    return (
      <span
        className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      title="לחיצה לשינוי — נרשמה להשלמה"
      className={`inline-flex min-w-[2.25rem] items-center justify-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60 ${badgeClass}`}
    >
      {busy ? <Spinner className="size-3" /> : label}
    </button>
  );
}

function formatMakeupDate(iso: string | null) {
  if (!iso) return "—";
  const ymd = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return formatHebrewDateFromYmd(ymd);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("he-IL");
}

function makeupDateYmd(iso: string | null): string | null {
  if (!iso) return null;
  const ymd = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

export function MakeupsClient() {
  const { viewingYear, viewingTerm, readOnly } = useAcademicYear();
  const yearId = viewingYear?.id;
  const { data, error, isLoading, mutate } = useSWR<{ makeups: Row[] }>(
    withYearTermQuery("/api/makeups", yearId, viewingTerm),
    fetcher,
  );
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeLegacy, setCompleteLegacy] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [registerRow, setRegisterRow] = useState<Row | null>(null);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [editGradeId, setEditGradeId] = useState<string | null>(null);
  const [editGradeValue, setEditGradeValue] = useState("");
  const [editGradeBusy, setEditGradeBusy] = useState(false);
  const [examModalId, setExamModalId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [autoRegisteredFilter, setAutoRegisteredFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState("");
  const [makeupDateFrom, setMakeupDateFrom] = useState("");
  const [makeupDateTo, setMakeupDateTo] = useState("");
  const [autoRegisteredBusyId, setAutoRegisteredBusyId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(searchTerm);

  const allRows = data?.makeups ?? [];
  const filteredRows = useMemo(() => {
    return allRows.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (gradeFilter && (m.student?.grade_level ?? "") !== gradeFilter) return false;
      if (autoRegisteredFilter === "yes" && !m.auto_registered) return false;
      if (autoRegisteredFilter === "no" && m.auto_registered) return false;
      if (paidFilter === "yes" && !m.is_paid) return false;
      if (paidFilter === "no" && m.is_paid) return false;
      if (makeupDateFrom || makeupDateTo) {
        const ymd = makeupDateYmd(m.completed_at);
        if (!ymd) return false;
        if (makeupDateFrom && ymd < makeupDateFrom) return false;
        if (makeupDateTo && ymd > makeupDateTo) return false;
      }
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
  }, [allRows, deferredSearch, statusFilter, gradeFilter, autoRegisteredFilter, paidFilter, makeupDateFrom, makeupDateTo]);

  const totalCount = allRows.length;
  const count = filteredRows.length;
  const isFiltering = Boolean(
    deferredSearch.trim() ||
      statusFilter ||
      gradeFilter ||
      autoRegisteredFilter ||
      paidFilter ||
      makeupDateFrom ||
      makeupDateTo,
  );

  function onRegisteredToggle(row: Row) {
    if (readOnly || autoRegisteredBusyId) return;
    if (row.auto_registered) {
      const studentLabel = row.student
        ? `${row.student.first_name} ${row.student.last_name}`.trim()
        : "התלמידה";
      const ok = confirm(
        `לבטל את הרישום להשלמה של ${studentLabel}?\n\n` +
          `תאריך השלמה, ציון התחלה ו«בתשלום» יימחקו. ההשלמה עצמה תישאר פתוחה.`,
      );
      if (!ok) return;
      void clearRegistration(row);
      return;
    }
    setRegisterRow(row);
  }

  async function clearRegistration(row: Row) {
    setAutoRegisteredBusyId(row.id);
    try {
      const r = await fetch(withYearQuery(`/api/makeups/${row.id}`, yearId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear_registration: true }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "עדכון נכשל");
      await mutate();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAutoRegisteredBusyId(null);
    }
  }

  async function saveRegistration(payload: RegisterForMakeupPayload) {
    if (!registerRow) return;
    setRegisterBusy(true);
    try {
      const r = await fetch(withYearQuery(`/api/makeups/${registerRow.id}`, yearId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_registered: true,
          completed_at: payload.completed_at,
          starting_grade: payload.starting_grade,
          is_paid: payload.is_paid,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "שמירה נכשלה");
      setRegisterRow(null);
      await mutate();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setRegisterBusy(false);
    }
  }

  function onCompleteClick(row: Row) {
    if (row.auto_registered && row.completed_at) {
      const studentLabel = row.student
        ? `${row.student.first_name} ${row.student.last_name}`.trim()
        : "התלמידה";
      const ok = confirm(`לסמן שההשלמה של ${studentLabel} הושלמה?`);
      if (!ok) return;
      void completeDirect(row.id);
      return;
    }
    setCompleteLegacy(true);
    setCompleteId(row.id);
  }

  async function completeDirect(id: string) {
    setCompleteBusy(true);
    try {
      const r = await fetch(withYearQuery(`/api/makeups/${id}/complete`, yearId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "עדכון נכשל");
      await mutate();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCompleteBusy(false);
    }
  }

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
      setCompleteLegacy(false);
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

  function displayNotes(m: Row): string {
    return combinedMakeupDisplayNotes({
      makeupNotes: m.notes,
      examNotes: m.exam?.notes,
      examStudentNotes: m.exam_student_notes,
    });
  }

  function exportMakeupsRows(): Record<string, string | number | boolean | null | undefined>[] {
    const statusHe: Record<string, string> = {
      open: "פתוח",
      completed: "הושלם",
    };
    return filteredRows.map((m) => ({
      סטטוס: statusHe[m.status] ?? m.status,
      נרשמה_להשלמה: m.auto_registered ? "כן" : "לא",
      תאריך_השלמה:
        m.auto_registered && m.completed_at ? formatMakeupDate(m.completed_at) : "",
      ציון_התחלה: m.auto_registered && m.starting_grade != null ? m.starting_grade : "",
      בתשלום: m.auto_registered ? (m.is_paid ? "כן" : "לא") : "",
      נוצר: m.created_at?.slice(0, 19) ?? "",
      שם_תלמידה: m.student ? `${m.student.last_name} ${m.student.first_name}` : "",
      שם_מבחן: m.exam?.subject ?? "",
      תאריך_מבחן: m.exam?.exam_date ? formatHebrewDateFromYmd(m.exam.exam_date) : "",
      מורה: m.exam?.teacher_name ?? "",
      ציון: m.grade ?? "",
      הערה: displayNotes(m) || "",
    }));
  }

  function makeupPrintFields(m: Row): MakeupPrintRow {
    const student = m.student
      ? escapePrintText(`${m.student.last_name} ${m.student.first_name}`)
      : "";
    const exam = escapePrintText(m.exam?.subject ?? "");
    const teacher = escapePrintText(m.exam?.teacher_name ?? "");
    const makeupDate =
      m.auto_registered && m.completed_at ? escapePrintText(formatMakeupDate(m.completed_at)) : "";
    const startGrade =
      m.auto_registered && m.starting_grade != null ? escapePrintText(String(m.starting_grade)) : "";
    const paid = m.auto_registered ? (m.is_paid ? "כן" : "לא") : "";
    const note = escapePrintText(displayNotes(m));
    return { student, exam, teacher, makeupDate, startGrade, paid, note };
  }

  function makeupListPrintFields(m: Row): MakeupListPrintRow {
    return {
      student: m.student
        ? escapePrintText(`${m.student.last_name} ${m.student.first_name}`)
        : "",
      exam: escapePrintText(m.exam?.subject ?? ""),
      examDate: m.exam?.exam_date ? escapePrintText(formatHebrewDateFromYmd(m.exam.exam_date)) : "",
      makeupDate:
        m.auto_registered && m.completed_at ? escapePrintText(formatMakeupDate(m.completed_at)) : "",
      teacher: escapePrintText(m.exam?.teacher_name ?? ""),
      note: escapePrintText(displayNotes(m)),
    };
  }

  function handlePrintList() {
    const rows = filteredRows.map(makeupListPrintFields);
    if (!rows.length) {
      alert("אין נתונים להדפסה לפי הסינון הנוכחי");
      return;
    }
    const logoUrl = `${window.location.origin}/logo.png`;
    openPrintDocument({
      title: "רשימת השלמות",
      styles: MAKEUPS_LIST_PRINT_CSS,
      bodyHtml: buildMakeupsListPrintHtml({
        rows,
        logoUrl,
      }),
    });
  }

  function handlePrintLabels() {
    const rows = filteredRows.map(makeupPrintFields);
    if (!rows.length) {
      alert("אין נתונים להדפסה לפי הסינון הנוכחי");
      return;
    }
    openPrintDocument({
      title: "מדבקות השלמות",
      styles: MAKEUPS_LABELS_PRINT_CSS,
      bodyHtml: buildMakeupsLabelsPrintHtml({ rows }),
    });
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="השלמות"
        subtitle="מבחנים חסרים — סימון השלמה מעדכן גם את סטטוס המבחן"
        actions={
          <ExportExcelButton
            label="ייצוא לאקסל (לפי סינון)"
            filename="השלמות"
            sheetName="השלמות"
            getRows={async () => exportMakeupsRows()}
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
            {
              id: "auto_registered",
              label: "נרשמה להשלמה",
              value: autoRegisteredFilter,
              onChange: setAutoRegisteredFilter,
              options: [
                { value: "yes", label: "כן — נרשמה להשלמה" },
                { value: "no", label: "לא — לא נרשמה" },
              ],
            },
            {
              id: "paid",
              label: "בתשלום",
              value: paidFilter,
              onChange: setPaidFilter,
              options: [
                { value: "yes", label: "כן — בתשלום" },
                { value: "no", label: "לא — לא בתשלום" },
              ],
            },
          ]}
          isAnyActive={isFiltering}
          onClearAll={() => {
            setSearchTerm("");
            setStatusFilter("");
            setGradeFilter("");
            setAutoRegisteredFilter("");
            setPaidFilter("");
            setMakeupDateFrom("");
            setMakeupDateTo("");
          }}
        />
        <div className="border-t border-slate-200/70 px-4 py-3 dark:border-zinc-700/70 sm:px-5">
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HebrewDatePicker
              label="תאריך השלמה — מתאריך"
              value={makeupDateFrom}
              onChange={setMakeupDateFrom}
              allowEmpty
              emptyHint="לא נבחר — בחרי לסינון מתאריך"
            />
            <HebrewDatePicker
              label="תאריך השלמה — עד תאריך"
              value={makeupDateTo}
              onChange={setMakeupDateTo}
              allowEmpty
              emptyHint="לא נבחר — בחרי לסינון עד תאריך"
            />
            {makeupDateFrom || makeupDateTo ? (
              <button
                type="button"
                onClick={() => {
                  setMakeupDateFrom("");
                  setMakeupDateTo("");
                }}
                className="self-end rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                נקה תאריכים
              </button>
            ) : null}
            {makeupDateFrom && makeupDateTo && makeupDateFrom > makeupDateTo ? (
              <p className="text-xs text-amber-700 sm:col-span-2 lg:col-span-3">
                שימי לב — «מתאריך» מאוחר מ«עד תאריך».
              </p>
            ) : null}
          </div>
        </div>
      </ListDataCard>

      <ListDataCard enterDelay={0.09}>
        <ListTableToolbar>
          <div className="flex flex-wrap items-center gap-3">
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
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                onClick={handlePrintList}
              >
                הדפסת רשימה
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                onClick={handlePrintLabels}
              >
                הדפסת מדבקות
              </button>
            </div>
          </div>
        </ListTableToolbar>
        <Table className="w-full table-fixed text-[11px]">
          <colgroup>
            <col style={{ width: "13%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "4%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-1 py-2">תלמידה</TableHead>
              <TableHead className="px-1 py-2">מבחן</TableHead>
              <TableHead className="px-1 py-2" title="תאריך מבחן">ת.מבחן</TableHead>
              <TableHead className="px-1 py-2">מורה</TableHead>
              <TableHead className="px-1 py-2" title="סטטוס">סט׳</TableHead>
              <TableHead className="px-1 py-2" title="נרשמה להשלמה">נר׳</TableHead>
              <TableHead className="px-1 py-2" title="תאריך השלמה">ת.השלמה</TableHead>
              <TableHead className="px-1 py-2" title="ציון התחלה">צ.התחלה</TableHead>
              <TableHead className="px-1 py-2" title="בתשלום">תש׳</TableHead>
              <TableHead className="px-1 py-2">ציון</TableHead>
              <TableHead className="px-1 py-2">הערה</TableHead>
              <TableHead className="px-1 py-2">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length ? (
              filteredRows.map((m) => {
                const notesText = displayNotes(m);
                return (
                <TableRow key={m.id}>
                  <TableCell className="truncate px-1.5 py-1.5 font-medium" title={m.student ? `${m.student.last_name} ${m.student.first_name}` : undefined}>
                    {m.student ? `${m.student.last_name} ${m.student.first_name}` : "—"}
                  </TableCell>
                  <TableCell className="truncate px-1.5 py-1.5" title={m.exam?.subject ?? undefined}>
                    {m.exam?.subject ?? "—"}
                  </TableCell>
                  <TableCell className="truncate px-1 py-1 tabular-nums" title={m.exam?.exam_date ? formatHebrewDateFromYmd(m.exam.exam_date) : undefined}>
                    {m.exam?.exam_date ? formatHebrewDateFromYmd(m.exam.exam_date) : "—"}
                  </TableCell>
                  <TableCell className="truncate px-1.5 py-1.5" title={m.exam?.teacher_name ?? undefined}>
                    {m.exam?.teacher_name ?? "—"}
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5">
                    <MakeupStatusBadge status={m.status as "open" | "completed"} />
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5">
                    <RegisteredForMakeupCell
                      value={Boolean(m.auto_registered)}
                      readOnly={readOnly}
                      busy={autoRegisteredBusyId === m.id}
                      onToggle={() => onRegisteredToggle(m)}
                    />
                  </TableCell>
                  <TableCell className="truncate px-1 py-1 tabular-nums" title={m.auto_registered && m.completed_at ? formatMakeupDate(m.completed_at) : undefined}>
                    {m.auto_registered && m.completed_at ? formatMakeupDate(m.completed_at) : "—"}
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5 tabular-nums">
                    {m.auto_registered && m.starting_grade != null ? m.starting_grade : "—"}
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5">
                    {m.auto_registered ? (
                      <span
                        className={
                          m.is_paid
                            ? "font-semibold text-emerald-600"
                            : "text-slate-500"
                        }
                      >
                        {m.is_paid ? "כן" : "לא"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="px-1.5 py-1.5 tabular-nums">{m.grade ?? "—"}</TableCell>
                  <TableCell className="max-w-0 px-1.5 py-1.5">
                    {notesText ? (
                      <span
                        className="line-clamp-2 whitespace-pre-line text-[11px] leading-snug text-amber-900 dark:text-amber-200"
                        title={notesText}
                      >
                        {notesText}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-1 py-1.5">
                    <div className="flex flex-wrap justify-end gap-0.5">
                      <Link
                        href={`/students/${m.student_id}`}
                        className={`${LIST_ROW_LINK_CLASS} !rounded-lg !px-1 !py-0.5`}
                        title="כרטיס תלמידה"
                      >
                        <UserRound className="size-3 shrink-0 opacity-80" strokeWidth={2} />
                        <span className="sr-only">כרטיס תלמידה</span>
                      </Link>
                      <button
                        type="button"
                        className={`${LIST_ROW_LINK_CLASS} !rounded-lg !px-1 !py-0.5`}
                        title="למבחן"
                        onClick={() => setExamModalId(m.exam_id)}
                      >
                        <BookOpen className="size-3 shrink-0 opacity-80" strokeWidth={2} />
                        <span className="sr-only">למבחן</span>
                      </button>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-1 py-0.5"
                          title="עריכת ציון"
                          onClick={() => {
                            setEditGradeId(m.id);
                            setEditGradeValue(m.grade != null ? String(m.grade) : "");
                          }}
                        >
                          <Pencil className="size-3 shrink-0" strokeWidth={2} />
                          <span className="sr-only">ציון</span>
                        </button>
                      ) : null}
                      {!readOnly && m.status === "open" ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-1 py-0.5"
                          title="סימון הושלם"
                          onClick={() => onCompleteClick(m)}
                          disabled={completeBusy}
                        >
                          <CheckCircle2 className="size-3 shrink-0" strokeWidth={2} />
                          <span className="sr-only">הושלם</span>
                        </button>
                      ) : null}
                      {!readOnly ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-1 py-0.5 text-amber-900 hover:bg-amber-100"
                          title="ביטול השלמה"
                          onClick={() => void undoMakeup(m)}
                        >
                          <Undo2 className="size-3 shrink-0" strokeWidth={2} />
                          <span className="sr-only">ביטול</span>
                        </button>
                      ) : null}
                      <NotesButton
                        entity="makeups"
                        id={m.id}
                        compact
                        iconOnly
                        label="הערה"
                        modalTitle={`הערה — ${m.student ? `${m.student.first_name} ${m.student.last_name}`.trim() : "השלמה"}`}
                        hasNote={hasAnyMakeupDisplayNote({
                          makeupNotes: m.notes,
                          examNotes: m.exam?.notes,
                          examStudentNotes: m.exam_student_notes,
                        })}
                        onSaved={() => void mutate()}
                      />
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="py-14 text-center text-zinc-500">
                  {isLoading ? "טוען…" : isFiltering ? "אין תוצאות תואמות לסינון" : "אין השלמות"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {!readOnly ? (
          <TableClearFooter
            label="השלמות"
            count={totalCount}
            apiPath={withYearTermQuery("/api/makeups/clear-all", yearId, viewingTerm)}
            onCleared={() => void mutate()}
          />
        ) : null}
      </ListDataCard>

      <RegisterForMakeupDialog
        open={Boolean(registerRow)}
        onClose={() => !registerBusy && setRegisterRow(null)}
        busy={registerBusy}
        studentLabel={
          registerRow?.student
            ? `${registerRow.student.first_name} ${registerRow.student.last_name}`.trim()
            : undefined
        }
        onSave={saveRegistration}
      />

      <CompleteMakeupDialog
        open={Boolean(completeId) && completeLegacy}
        onClose={() => !completeBusy && (setCompleteId(null), setCompleteLegacy(false))}
        busy={completeBusy}
        title="סימון השלמה (ללא רישום מוקדם)"
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

      <ExamWorkspaceModal
        examId={examModalId}
        open={Boolean(examModalId)}
        onClose={() => setExamModalId(null)}
      />
    </div>
  );
}
