"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_ROW_LINK_CLASS,
} from "@/components/ui/ListPage";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { HebrewDateTimePicker } from "@/components/ui/HebrewDateTimePicker";
import { ListFilterBar, matchesNameQuery } from "@/components/ui/ListFilterBar";
import { interactiveCursor } from "@/lib/ui/interactiveCursor";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
import {
  examTrackingDueDate,
  EXAM_SUBMISSION_DUE_OFFSET,
  formatTrackingDateTime,
  GRADES_SUBMISSION_DUE_OFFSET,
} from "@/lib/tracking/dates";
import { MakeupTrackingTab } from "./MakeupTrackingTab";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Row = {
  id: string;
  exam_id: string;
  submitted_exam: string | null;
  approved_by_coordinator: boolean;
  sent_for_review: boolean;
  grades_submitted: boolean;
  grades_approved: boolean;
  transferred_to_system: boolean;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

type SortKey = "exam_date" | "submission_due" | "grades_due" | "submitted_exam" | "teacher_name";
type DateColumnKey = "exam_date" | "submission_due" | "grades_due" | "submitted_exam";

function addDays(ymd: string, offset: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  // חישוב בשעות מקומיות כדי למנוע סחיפת אזור זמן
  const d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sortValue(row: Row, key: SortKey): string | null {
  const examDate = row.exam?.exam_date ?? null;
  if (key === "exam_date") return examDate;
  if (key === "submission_due") return examDate ? addDays(examDate, EXAM_SUBMISSION_DUE_OFFSET) : null;
  if (key === "grades_due") return examDate ? addDays(examDate, GRADES_SUBMISSION_DUE_OFFSET) : null;
  if (key === "submitted_exam") return row.submitted_exam;
  if (key === "teacher_name") {
    const name = (row.exam?.teacher_name ?? "").trim();
    return name || null;
  }
  return null;
}

/** YMD ("YYYY-MM-DD") של הערך הרלוונטי לסינון לפי עמודת תאריך — או null אם אין */
function dateColumnYmd(row: Row, key: DateColumnKey): string | null {
  const examDate = row.exam?.exam_date ?? null;
  if (key === "exam_date") return examDate;
  if (key === "submission_due") return examDate ? addDays(examDate, EXAM_SUBMISSION_DUE_OFFSET) : null;
  if (key === "grades_due") return examDate ? addDays(examDate, GRADES_SUBMISSION_DUE_OFFSET) : null;
  if (key === "submitted_exam") return row.submitted_exam ? row.submitted_exam.slice(0, 10) : null;
  return null;
}

const DATE_COLUMN_OPTIONS: { value: DateColumnKey; label: string }[] = [
  { value: "exam_date", label: "תאריך מבחן" },
  { value: "submission_due", label: "הגשת המבחן" },
  { value: "grades_due", label: "הגשת ציונים" },
  { value: "submitted_exam", label: "הוגש מבחן (בפועל)" },
];

function formatSubmittedDisplay(iso: string | null) {
  return formatTrackingDateTime(iso);
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 transition hover:bg-slate-200/60 ${
        active ? "text-zinc-900" : "text-zinc-700"
      }`}
      title="לחיצה למיון — לחיצה שניה להפיכה — שלישית לביטול"
    >
      <span>{label}</span>
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="size-3" strokeWidth={2.5} />
        ) : (
          <ArrowDown className="size-3" strokeWidth={2.5} />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-40" strokeWidth={2} />
      )}
    </button>
  );
}

function BoolCell({ value }: { value: boolean }) {
  return (
    <span className={value ? "font-semibold text-emerald-600" : "text-slate-400"}>
      {value ? "כן" : "לא"}
    </span>
  );
}

export function TrackingClient() {
  const [tab, setTab] = useState<"exams" | "makeups">("exams");
  const { viewingYear, readOnly } = useAcademicYear();
  const yearId = viewingYear?.id;
  const { data, error, isLoading, mutate } = useSWR<{ tracking: Row[] }>(
    withYearQuery("/api/tracking", yearId),
    fetcher,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("exam_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateColumn, setDateColumn] = useState<DateColumnKey>("exam_date");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const deferredSearch = useDeferredValue(searchTerm);

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    setSortKey(null);
  }

  const allRows = data?.tracking ?? [];
  const filteredRows = useMemo(() => {
    const filtered = allRows.filter((row) => {
      if (stageFilter) {
        const isDone =
          row.transferred_to_system && row.grades_approved && row.grades_submitted;
        if (stageFilter === "done" && !isDone) return false;
        if (stageFilter === "open" && isDone) return false;
        if (stageFilter === "not-submitted" && row.submitted_exam) return false;
        if (stageFilter === "submitted" && !row.submitted_exam) return false;
        if (stageFilter === "approved" && !row.approved_by_coordinator) return false;
        if (stageFilter === "pending-grades" && (row.grades_submitted || !row.submitted_exam))
          return false;
      }
      if (dateFrom || dateTo) {
        const ymd = dateColumnYmd(row, dateColumn);
        if (!ymd) return false; // שורות בלי תאריך באותה עמודה — מוסתרות כשמפעילים סינון
        if (dateFrom && ymd < dateFrom) return false;
        if (dateTo && ymd > dateTo) return false;
      }
      if (deferredSearch.trim()) {
        const matches = matchesNameQuery(deferredSearch, [
          row.exam?.teacher_name,
          row.exam?.subject,
        ]);
        if (!matches) return false;
      }
      return true;
    });
    if (!sortKey) return filtered;
    const sign = sortDir === "asc" ? 1 : -1;
    const isNameSort = sortKey === "teacher_name";
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === bv) return 0;
      if (av === null) return 1; // ריקים בסוף תמיד
      if (bv === null) return -1;
      if (isNameSort) {
        return av.localeCompare(bv, "he") * sign;
      }
      return av < bv ? -1 * sign : 1 * sign;
    });
  }, [allRows, deferredSearch, stageFilter, sortKey, sortDir, dateColumn, dateFrom, dateTo]);

  const totalCount = allRows.length;
  const count = filteredRows.length;
  const isFiltering = Boolean(deferredSearch.trim() || stageFilter || dateFrom || dateTo);

  async function saveRow(
    id: string,
    payload: {
      submitted_exam: string | null;
      approved_by_coordinator: boolean;
      sent_for_review: boolean;
      grades_submitted: boolean;
      grades_approved: boolean;
      transferred_to_system: boolean;
    },
  ) {
    const r = await fetch(withYearQuery(`/api/tracking/${id}`, yearId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "עדכון נכשל");
      return;
    }
    setEditingId(null);
    await mutate();
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="מעקב"
        subtitle={
          tab === "exams"
            ? "מעקב מבחנים — לשינוי לחצי «עריכה» בשורה"
            : "מעקב השלמות — לפי מבחן ומורה"
        }
        actions={
          tab === "exams" ? (
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="מעקב-מבחנים"
              sheetName="מעקב"
              exportUrl={withYearQuery("/api/export/tracking", yearId)}
            />
          ) : null
        }
      />

      <div className="flex gap-1 border-b border-zinc-200">
        {(["exams", "makeups"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t === "exams" ? "מעקב מבחנים" : "מעקב השלמות מבחנים"}
          </button>
        ))}
      </div>

      {tab === "makeups" ? <MakeupTrackingTab /> : null}

      {tab === "exams" ? (
        <>
        <ListDataCard>
          <ListFilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchLabel="חיפוש מבחן במעקב"
            searchPlaceholder="למשל: שרה כהן · גרפיקה…"
            searchHint="חיפוש לפי שם מורה (פרטי + משפחה) · מקצוע"
            filters={[
              {
                id: "stage",
                label: "שלב",
                value: stageFilter,
                onChange: setStageFilter,
                options: [
                  { value: "open", label: "פתוח (טרם הסתיים)" },
                  { value: "done", label: "הסתיים (הועבר למערכת)" },
                  { value: "not-submitted", label: "מבחן לא הוגש" },
                  { value: "submitted", label: "מבחן הוגש" },
                  { value: "approved", label: "אושר ע״י רכזת" },
                  { value: "pending-grades", label: "ממתין לציונים" },
                ],
              },
            ]}
            isAnyActive={isFiltering}
            onClearAll={() => {
              setSearchTerm("");
              setStageFilter("");
              setDateFrom("");
              setDateTo("");
            }}
          />
          <div className="border-t border-slate-200/70 px-4 py-3 dark:border-zinc-700/70 sm:px-5">
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">סינון לפי תאריך</span>
                <select
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value as DateColumnKey)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  {DATE_COLUMN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <HebrewDatePicker
                label="מתאריך"
                value={dateFrom}
                onChange={setDateFrom}
              />
              <HebrewDatePicker
                label="עד תאריך"
                value={dateTo}
                onChange={setDateTo}
              />
              <div className="flex items-center gap-2">
                {dateFrom || dateTo ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    נקה טווח
                  </button>
                ) : null}
              </div>
            </div>
            {dateFrom && dateTo && dateFrom > dateTo ? (
              <p className="mt-2 text-xs text-amber-700">
                שימי לב — «מתאריך» מאוחר מ«עד תאריך». לא יוצגו תוצאות בטווח כזה.
              </p>
            ) : null}
          </div>
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
                {count} שורות{isFiltering && count !== totalCount ? ` · מתוך ${totalCount}` : ""}
              </span>
            )}
          </ListTableToolbar>
          <Table className="min-w-[1320px]">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton
                    label="מורה"
                    active={sortKey === "teacher_name"}
                    dir={sortDir}
                    onClick={() => toggleSort("teacher_name")}
                  />
                </TableHead>
                <TableHead>מקצוע</TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton
                    label="הגשת המבחן"
                    active={sortKey === "submission_due"}
                    dir={sortDir}
                    onClick={() => toggleSort("submission_due")}
                  />
                </TableHead>
                <TableHead>
                  <SortButton
                    label="תאריך"
                    active={sortKey === "exam_date"}
                    dir={sortDir}
                    onClick={() => toggleSort("exam_date")}
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton
                    label="הגשת ציונים"
                    active={sortKey === "grades_due"}
                    dir={sortDir}
                    onClick={() => toggleSort("grades_due")}
                  />
                </TableHead>
                <TableHead>מבחן</TableHead>
                <TableHead className="whitespace-nowrap">
                  <SortButton
                    label="הוגש מבחן"
                    active={sortKey === "submitted_exam"}
                    dir={sortDir}
                    onClick={() => toggleSort("submitted_exam")}
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap">אישור רכזת</TableHead>
                <TableHead className="whitespace-nowrap">נשלח לבדיקה</TableHead>
                <TableHead className="whitespace-nowrap">ציונים הוגשו</TableHead>
                <TableHead className="whitespace-nowrap">ציונים אושרו</TableHead>
                <TableHead className="whitespace-nowrap">הועבר למערכת</TableHead>
                <TableHead>עריכה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell className="font-medium">{row.exam?.teacher_name ?? "—"}</TableCell>
                    <TableCell>{row.exam?.subject ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-zinc-600">
                      {examTrackingDueDate(row.exam?.exam_date, EXAM_SUBMISSION_DUE_OFFSET)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.exam?.exam_date ? formatHebrewDateFromYmd(row.exam.exam_date) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-zinc-600">
                      {examTrackingDueDate(row.exam?.exam_date, GRADES_SUBMISSION_DUE_OFFSET)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/exams/${row.exam_id}`}
                        className={`${LIST_ROW_LINK_CLASS} ${interactiveCursor.exam}`}
                      >
                        פתיחת מבחן
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatSubmittedDisplay(row.submitted_exam)}
                    </TableCell>
                    <TableCell>
                      <BoolCell value={row.approved_by_coordinator} />
                    </TableCell>
                    <TableCell>
                      <BoolCell value={row.sent_for_review} />
                    </TableCell>
                    <TableCell>
                      <BoolCell value={row.grades_submitted} />
                    </TableCell>
                    <TableCell>
                      <BoolCell value={row.grades_approved} />
                    </TableCell>
                    <TableCell>
                      <BoolCell value={row.transferred_to_system} />
                    </TableCell>
                    <TableCell>
                      {editingId === row.id ? (
                        <TrackingRowForm
                          key={row.id}
                          row={row}
                          onCancel={() => setEditingId(null)}
                          onSave={(payload) => void saveRow(row.id, payload)}
                        />
                      ) : !readOnly ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                          onClick={() => setEditingId(row.id)}
                        >
                          <Pencil className="size-3.5" strokeWidth={2} />
                          עריכה
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={13} className="py-14 text-center text-zinc-500">
                    {isLoading ? "טוען…" : isFiltering ? "אין תוצאות תואמות לסינון" : "אין נתוני מעקב"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!readOnly ? (
            <TableClearFooter
              label="שורות מעקב"
              count={totalCount}
              apiPath={withYearQuery("/api/tracking/clear-all", yearId)}
              onCleared={() => void mutate()}
            />
          ) : null}
        </ListDataCard>
        </>
      ) : null}
    </div>
  );
}

function TrackingRowForm({
  row,
  onCancel,
  onSave,
}: {
  row: Row;
  onCancel: () => void;
  onSave: (p: {
    submitted_exam: string | null;
    approved_by_coordinator: boolean;
    sent_for_review: boolean;
    grades_submitted: boolean;
    grades_approved: boolean;
    transferred_to_system: boolean;
  }) => void;
}) {
  const [submittedIso, setSubmittedIso] = useState<string | null>(row.submitted_exam);
  const [approved, setApproved] = useState(row.approved_by_coordinator);
  const [sent, setSent] = useState(row.sent_for_review);
  const [gradesIn, setGradesIn] = useState(row.grades_submitted);
  const [gradesOk, setGradesOk] = useState(row.grades_approved);
  const [transferred, setTransferred] = useState(row.transferred_to_system);

  return (
    <div className="flex min-w-[300px] flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
      <HebrewDateTimePicker
        label="הוגש מבחן"
        value={submittedIso}
        onChange={setSubmittedIso}
      />
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        אישור רכזת
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} />
        נשלח לבדיקה
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={gradesIn} onChange={(e) => setGradesIn(e.target.checked)} />
        ציונים הוגשו
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={gradesOk} onChange={(e) => setGradesOk(e.target.checked)} />
        ציונים אושרו
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={transferred} onChange={(e) => setTransferred(e.target.checked)} />
        הועבר למערכת
      </label>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-[11px] text-white"
          onClick={() => {
            onSave({
              submitted_exam: submittedIso,
              approved_by_coordinator: approved,
              sent_for_review: sent,
              grades_submitted: gradesIn,
              grades_approved: gradesOk,
              transferred_to_system: transferred,
            });
          }}
        >
          שמירה
        </button>
        <button type="button" className="rounded-md border px-2 py-1 text-[11px]" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}
