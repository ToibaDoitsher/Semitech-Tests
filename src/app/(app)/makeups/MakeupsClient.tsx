"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Pencil, Undo2, UserRound } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
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
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
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
        className={`inline-flex min-w-[3rem] items-center justify-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${badgeClass}`}
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
      className={`inline-flex min-w-[3rem] items-center justify-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60 ${badgeClass}`}
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
  const { viewingYear, readOnly } = useAcademicYear();
  const yearId = viewingYear?.id;
  const { data, error, isLoading, mutate } = useSWR<{ makeups: Row[] }>(
    withYearQuery("/api/makeups", yearId),
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

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
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
      statusFilter !== "open" ||
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
      הערה: (m.notes ?? "").trim() || "",
    }));
  }

  function openPrintWindow(title: string, bodyHtml: string, extraHead: string = "") {
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.write(`<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charSet="utf-8" />
<title>${title}</title>
<style>
@page { size: A4; margin: 10mm; }
body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; }
table { width: 100%; border-collapse: collapse; font-size: 11pt; }
th, td { border: 1px solid #e5e7eb; padding: 4px 6px; vertical-align: top; }
th { background: #f1f5f9; }
.small { font-size: 9pt; color: #6b7280; }
.labels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; }
.label-item { box-sizing: border-box; border: 1px dashed #e5e7eb; padding: 3mm 2mm; height: 24mm; overflow: hidden; font-size: 9pt; }
.label-title { font-weight: 700; margin-bottom: 2px; }
.label-line { line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.page-title { font-size: 16pt; font-weight: 700; margin-bottom: 4mm; }
.summary { margin-bottom: 3mm; font-size: 10pt; color: #4b5563; }
</style>
${extraHead}
</head>
<body>
${bodyHtml}
</body>
</html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  function handlePrintList() {
    const rows = filteredRows;
    if (!rows.length) {
      alert("אין נתונים להדפסה לפי הסינון הנוכחי");
      return;
    }
    const header = `<div class="page-title">רשימת השלמות</div>
<div class="summary">סה\"כ ${rows.length} רשומות${isFiltering ? ` (מסונן מתוך ${totalCount})` : ""}</div>`;
    const table = `<table>
  <thead>
    <tr>
      <th>שם תלמידה</th>
      <th>שם המבחן</th>
      <th>תאריך השלמה</th>
      <th>שם המורה</th>
      <th>ציון התחלה</th>
      <th>בתשלום</th>
      <th>הערה</th>
    </tr>
  </thead>
  <tbody>
    ${rows
      .map((m) => {
        const student = m.student ? `${m.student.last_name} ${m.student.first_name}` : "";
        const exam = m.exam?.subject ?? "";
        const teacher = m.exam?.teacher_name ?? "";
        const makeupDate = m.auto_registered && m.completed_at ? formatMakeupDate(m.completed_at) : "";
        const startGrade =
          m.auto_registered && m.starting_grade != null ? String(m.starting_grade) : "";
        const paid = m.auto_registered ? (m.is_paid ? "כן" : "לא") : "";
        const note = (m.notes ?? "").trim();
        return `<tr>
  <td>${student}</td>
  <td>${exam}</td>
  <td>${makeupDate}</td>
  <td>${teacher}</td>
  <td>${startGrade}</td>
  <td>${paid}</td>
  <td>${note}</td>
</tr>`;
      })
      .join("")}
  </tbody>
</table>`;
    openPrintWindow("רשימת השלמות", `${header}${table}`);
  }

  function handlePrintLabels() {
    const rows = filteredRows;
    if (!rows.length) {
      alert("אין נתונים להדפסה לפי הסינון הנוכחי");
      return;
    }
    const labelsHtml = `<div class="page-title">מדבקות השלמות</div>
<div class="summary">סה\"כ ${rows.length} מדבקות${isFiltering ? ` (מסונן מתוך ${totalCount})` : ""}</div>
<div class="labels-grid">
${rows
  .map((m) => {
    const student = m.student ? `${m.student.last_name} ${m.student.first_name}` : "";
    const exam = m.exam?.subject ?? "";
    const teacher = m.exam?.teacher_name ?? "";
    const makeupDate = m.auto_registered && m.completed_at ? formatMakeupDate(m.completed_at) : "";
    const startGrade =
      m.auto_registered && m.starting_grade != null ? String(m.starting_grade) : "";
    const paid = m.auto_registered ? (m.is_paid ? "כן" : "לא") : "";
    const note = (m.notes ?? "").trim();
    return `<div class="label-item">
  <div class="label-title">${student || "תלמידה"}</div>
  <div class="label-line">מבחן: ${exam}</div>
  <div class="label-line">תאריך השלמה: ${makeupDate}</div>
  <div class="label-line">מורה: ${teacher}</div>
  <div class="label-line">ציון התחלה: ${startGrade}</div>
  <div class="label-line">בתשלום: ${paid}</div>
  <div class="label-line">הערה: ${note}</div>
</div>`;
  })
  .join("")}
</div>`;
    openPrintWindow("מדבקות השלמות", labelsHtml);
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
            setStatusFilter("open");
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
            />
            <HebrewDatePicker
              label="תאריך השלמה — עד תאריך"
              value={makeupDateTo}
              onChange={setMakeupDateTo}
            />
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
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead>תלמידה</TableHead>
              <TableHead>מבחן</TableHead>
              <TableHead>תאריך מבחן</TableHead>
              <TableHead>מורה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead className="whitespace-nowrap">נרשמה להשלמה</TableHead>
              <TableHead className="whitespace-nowrap">תאריך השלמה</TableHead>
              <TableHead className="whitespace-nowrap">ציון התחלה</TableHead>
              <TableHead className="whitespace-nowrap">בתשלום</TableHead>
              <TableHead>ציון</TableHead>
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
                  <TableCell>
                    <RegisteredForMakeupCell
                      value={Boolean(m.auto_registered)}
                      readOnly={readOnly}
                      busy={autoRegisteredBusyId === m.id}
                      onToggle={() => onRegisteredToggle(m)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {m.auto_registered && m.completed_at ? formatMakeupDate(m.completed_at) : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {m.auto_registered && m.starting_grade != null ? m.starting_grade : "—"}
                  </TableCell>
                  <TableCell>
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
                  <TableCell className="tabular-nums">{m.grade ?? "—"}</TableCell>
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
                          onClick={() => onCompleteClick(m)}
                          disabled={completeBusy}
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
                <TableCell colSpan={12} className="py-14 text-center text-zinc-500">
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
    </div>
  );
}
