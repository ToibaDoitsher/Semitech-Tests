"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Pencil } from "lucide-react";
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
  student_submission_date: string | null;
  reminder_1_hindi: string | null;
  reminder_2_biller: string | null;
  approved_by_coordinator: boolean;
  sent_for_review: boolean;
  grades_submitted: boolean;
  grades_approved: boolean;
  transferred_to_system: boolean;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

type SortKey =
  | "exam_date"
  | "student_submission_date"
  | "submission_due"
  | "grades_due"
  | "submitted_exam"
  | "teacher_name";
type DateColumnKey =
  | "exam_date"
  | "student_submission_date"
  | "submission_due"
  | "grades_due"
  | "submitted_exam";

/** המקור שעל פיו מחושב תאריך הגשת הציונים. */
function gradesDueBase(row: Row): { date: string | null; fromSubmission: boolean } {
  if (row.student_submission_date) {
    return { date: row.student_submission_date.slice(0, 10), fromSubmission: true };
  }
  return { date: row.exam?.exam_date ?? null, fromSubmission: false };
}

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
  if (key === "student_submission_date")
    return row.student_submission_date ? row.student_submission_date.slice(0, 10) : null;
  if (key === "submission_due") return examDate ? addDays(examDate, EXAM_SUBMISSION_DUE_OFFSET) : null;
  if (key === "grades_due") {
    const base = gradesDueBase(row).date;
    return base ? addDays(base, GRADES_SUBMISSION_DUE_OFFSET) : null;
  }
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
  if (key === "student_submission_date")
    return row.student_submission_date ? row.student_submission_date.slice(0, 10) : null;
  if (key === "submission_due") return examDate ? addDays(examDate, EXAM_SUBMISSION_DUE_OFFSET) : null;
  if (key === "grades_due") {
    const base = gradesDueBase(row).date;
    return base ? addDays(base, GRADES_SUBMISSION_DUE_OFFSET) : null;
  }
  if (key === "submitted_exam") return row.submitted_exam ? row.submitted_exam.slice(0, 10) : null;
  return null;
}

const DATE_COLUMN_OPTIONS: { value: DateColumnKey; label: string }[] = [
  { value: "exam_date", label: "תאריך מבחן" },
  { value: "student_submission_date", label: "הגשת מטלה (תלמידות)" },
  { value: "submission_due", label: "הגשת המבחן" },
  { value: "grades_due", label: "הגשת ציונים" },
  { value: "submitted_exam", label: "הוגש מבחן (בפועל)" },
];

function formatSubmittedDisplay(iso: string | null) {
  return formatTrackingDateTime(iso);
}

/** תאריך בלבד — לתצוגה קומפקטית בטבלה */
function formatSubmittedCompact(iso: string | null) {
  if (!iso?.trim()) return "—";
  const ymd = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return formatHebrewDateFromYmd(ymd);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatHebrewDateFromYmd(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  );
}

function formatOptionalDateYmd(value: string | null) {
  if (!value) return "—";
  const ymd = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return formatHebrewDateFromYmd(ymd);
  return "—";
}

function SortButton({
  label,
  title,
  active,
  dir,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? "לחיצה למיון — לחיצה שניה להפיכה — שלישית לביטול"}
      className={`inline-flex max-w-full items-center gap-0.5 rounded px-0.5 py-0.5 text-[11px] leading-tight transition hover:bg-slate-200/60 ${
        active ? "text-zinc-900" : "text-zinc-700"
      }`}
    >
      <span className="whitespace-normal text-start" title={title ?? label}>
        {label}
      </span>
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

function AbbrevHead({ label, title }: { label: string; title: string }) {
  return (
    <span className="whitespace-normal" title={title}>
      {label}
    </span>
  );
}

function BoolCell({ value }: { value: boolean }) {
  return (
    <span className={`text-[11px] ${value ? "font-semibold text-emerald-600" : "text-slate-400"}`}>
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
      student_submission_date: string | null;
      reminder_1_hindi: string | null;
      reminder_2_biller: string | null;
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
    const warning = (j as { warning?: string }).warning;
    if (warning) alert(warning);
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
          <Table className="w-full table-fixed text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="px-1 py-2">
                  <SortButton
                    label="מורה"
                    active={sortKey === "teacher_name"}
                    dir={sortDir}
                    onClick={() => toggleSort("teacher_name")}
                  />
                </TableHead>
                <TableHead className="px-1 py-2">מקצוע</TableHead>
                <TableHead className="px-1 py-2">
                  <SortButton
                    label="להגשה"
                    title="הגשת המבחן"
                    active={sortKey === "submission_due"}
                    dir={sortDir}
                    onClick={() => toggleSort("submission_due")}
                  />
                </TableHead>
                <TableHead className="px-1 py-2">
                  <SortButton
                    label="ת. מבחן"
                    title="תאריך מבחן"
                    active={sortKey === "exam_date"}
                    dir={sortDir}
                    onClick={() => toggleSort("exam_date")}
                  />
                </TableHead>
                <TableHead className="px-1 py-2">
                  <SortButton
                    label="מטלה"
                    title="הגשת מטלה (תלמידות)"
                    active={sortKey === "student_submission_date"}
                    dir={sortDir}
                    onClick={() => toggleSort("student_submission_date")}
                  />
                </TableHead>
                <TableHead className="px-1 py-2">
                  <SortButton
                    label="ציונים"
                    title="הגשת ציונים"
                    active={sortKey === "grades_due"}
                    dir={sortDir}
                    onClick={() => toggleSort("grades_due")}
                  />
                </TableHead>
                <TableHead className="w-[2.5rem] px-1 py-2">
                  <AbbrevHead label="מבחן" title="פתיחת מבחן" />
                </TableHead>
                <TableHead className="px-1 py-2">
                  <SortButton
                    label="הוגש"
                    title="הוגש מבחן (בפועל)"
                    active={sortKey === "submitted_exam"}
                    dir={sortDir}
                    onClick={() => toggleSort("submitted_exam")}
                  />
                </TableHead>
                <TableHead className="px-1 py-2 whitespace-normal">
                  <AbbrevHead label="רכזת" title="אישור רכזת" />
                </TableHead>
                <TableHead className="px-1 py-2 whitespace-normal">
                  <AbbrevHead label="בדיקה" title="נשלח לבדיקה" />
                </TableHead>
                <TableHead className="px-1 py-2 whitespace-normal">
                  <AbbrevHead label="תז׳ הינדי" title='תזכורת 1 ע"י הינדי' />
                </TableHead>
                <TableHead className="px-1 py-2 whitespace-normal">
                  <AbbrevHead label="תז׳ בילר" title='תזכורת 2 ע"י בילר' />
                </TableHead>
                <TableHead className="px-1 py-2 whitespace-normal">
                  <AbbrevHead label="צ. הוגשו" title="ציונים הוגשו" />
                </TableHead>
                <TableHead className="px-1 py-2 whitespace-normal">
                  <AbbrevHead label="צ. אושרו" title="ציונים אושרו" />
                </TableHead>
                <TableHead className="px-1 py-2 whitespace-normal">
                  <AbbrevHead label="במערכת" title="הועבר למערכת" />
                </TableHead>
                <TableHead className="w-[2.5rem] px-1 py-2">
                  <AbbrevHead label="עריכה" title="עריכת שורת מעקב" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <TableRow key={row.id} className="align-top">
                    <TableCell
                      className="truncate px-1 py-1.5 font-medium"
                      title={row.exam?.teacher_name ?? undefined}
                    >
                      {row.exam?.teacher_name ?? "—"}
                    </TableCell>
                    <TableCell className="truncate px-1 py-1.5" title={row.exam?.subject ?? undefined}>
                      {row.exam?.subject ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px] text-zinc-600">
                      {examTrackingDueDate(row.exam?.exam_date, EXAM_SUBMISSION_DUE_OFFSET)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px]">
                      {row.exam?.exam_date ? formatHebrewDateFromYmd(row.exam.exam_date) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px] text-zinc-700">
                      {row.student_submission_date
                        ? formatHebrewDateFromYmd(row.student_submission_date.slice(0, 10))
                        : "—"}
                    </TableCell>
                    {(() => {
                      const { date: gradesBase, fromSubmission } = gradesDueBase(row);
                      const cellClass = fromSubmission
                        ? "whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px] rounded bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                        : "whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px] text-zinc-600";
                      const title = fromSubmission
                        ? "מחושב 7 ימים אחרי הגשת המטלה ע״י התלמידות"
                        : "מחושב 7 ימים אחרי תאריך המבחן";
                      return (
                        <TableCell className={cellClass} title={title}>
                          {examTrackingDueDate(gradesBase, GRADES_SUBMISSION_DUE_OFFSET)}
                        </TableCell>
                      );
                    })()}
                    <TableCell className="px-1 py-1.5 text-center">
                      <Link
                        href={`/exams/${row.exam_id}`}
                        className={`${LIST_ROW_LINK_CLASS} !rounded-lg !px-1 !py-0.5`}
                        title="פתיחת מבחן"
                      >
                        <BookOpen className="size-3 shrink-0 opacity-80" strokeWidth={2} />
                        <span className="sr-only">פתיחת מבחן</span>
                      </Link>
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px]"
                      title={row.submitted_exam ? formatSubmittedDisplay(row.submitted_exam) : undefined}
                    >
                      {formatSubmittedCompact(row.submitted_exam)}
                    </TableCell>
                    <TableCell className="px-1 py-1.5 text-center">
                      <BoolCell value={row.approved_by_coordinator} />
                    </TableCell>
                    <TableCell className="px-1 py-1.5 text-center">
                      <BoolCell value={row.sent_for_review} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px]">
                      {formatOptionalDateYmd(row.reminder_1_hindi)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-1 py-1.5 tabular-nums text-[11px]">
                      {formatOptionalDateYmd(row.reminder_2_biller)}
                    </TableCell>
                    <TableCell className="px-1 py-1.5 text-center">
                      <BoolCell value={row.grades_submitted} />
                    </TableCell>
                    <TableCell className="px-1 py-1.5 text-center">
                      <BoolCell value={row.grades_approved} />
                    </TableCell>
                    <TableCell className="px-1 py-1.5 text-center">
                      <BoolCell value={row.transferred_to_system} />
                    </TableCell>
                    <TableCell className="px-1 py-1.5">
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
                          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-1 py-0.5"
                          title="עריכה"
                          onClick={() => setEditingId(row.id)}
                        >
                          <Pencil className="size-3 shrink-0" strokeWidth={2} />
                          <span className="sr-only">עריכה</span>
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={16} className="py-14 text-center text-zinc-500">
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
    student_submission_date: string | null;
    reminder_1_hindi: string | null;
    reminder_2_biller: string | null;
    approved_by_coordinator: boolean;
    sent_for_review: boolean;
    grades_submitted: boolean;
    grades_approved: boolean;
    transferred_to_system: boolean;
  }) => void;
}) {
  const [examSubmitted, setExamSubmitted] = useState(Boolean(row.submitted_exam));
  const [submittedIso, setSubmittedIso] = useState<string | null>(row.submitted_exam);
  const [studentSubmissionDate, setStudentSubmissionDate] = useState<string>(
    row.student_submission_date ? row.student_submission_date.slice(0, 10) : "",
  );
  const [reminder1Hindi, setReminder1Hindi] = useState<string>(
    row.reminder_1_hindi ? row.reminder_1_hindi.slice(0, 10) : "",
  );
  const [reminder2Biller, setReminder2Biller] = useState<string>(
    row.reminder_2_biller ? row.reminder_2_biller.slice(0, 10) : "",
  );
  const [approved, setApproved] = useState(row.approved_by_coordinator);
  const [sent, setSent] = useState(row.sent_for_review);
  const [gradesIn, setGradesIn] = useState(row.grades_submitted);
  const [gradesOk, setGradesOk] = useState(row.grades_approved);
  const [transferred, setTransferred] = useState(row.transferred_to_system);

  function handleSave() {
    if (examSubmitted && !submittedIso) {
      alert('סימון «הוגש מבחן» דורש למלא תאריך ושעה של הגשת המבחן.');
      return;
    }
    onSave({
      submitted_exam: examSubmitted ? submittedIso : null,
      student_submission_date: studentSubmissionDate.trim() || null,
      reminder_1_hindi: reminder1Hindi.trim() || null,
      reminder_2_biller: reminder2Biller.trim() || null,
      approved_by_coordinator: approved,
      sent_for_review: sent,
      grades_submitted: gradesIn,
      grades_approved: gradesOk,
      transferred_to_system: transferred,
    });
  }

  return (
    <div className="flex min-w-[300px] flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
      <label className="inline-flex items-center gap-2 text-[11px] font-medium">
        <input
          type="checkbox"
          checked={examSubmitted}
          onChange={(e) => {
            const checked = e.target.checked;
            setExamSubmitted(checked);
            if (!checked) setSubmittedIso(null);
          }}
        />
        הוגש מבחן
      </label>
      {examSubmitted ? (
        <HebrewDateTimePicker
          label="תאריך ושעת הגשת מבחן *"
          value={submittedIso}
          onChange={setSubmittedIso}
          required
        />
      ) : null}
      <HebrewDatePicker
        label='תאריך הגשת מטלה ע"י תלמידות'
        value={studentSubmissionDate}
        onChange={setStudentSubmissionDate}
        allowEmpty
        emptyHint="לא נבחר — אופציונלי"
      />
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        אישור רכזת
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} />
        נשלח לבדיקה
      </label>
      <HebrewDatePicker
        label='תזכורת 1 ע"י הינדי'
        value={reminder1Hindi}
        onChange={setReminder1Hindi}
        allowEmpty
        emptyHint="לא נבחר — אופציונלי"
      />
      <HebrewDatePicker
        label='תזכורת 2 ע"י בילר'
        value={reminder2Biller}
        onChange={setReminder2Biller}
        allowEmpty
        emptyHint="לא נבחר — אופציונלי"
      />
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
          onClick={handleSave}
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
