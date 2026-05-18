"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, List } from "lucide-react";
import { useCallback, useState } from "react";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AssignmentColumnMap, ParsedAssignmentRow } from "@/lib/assignments/excelImport";

type PreviewRow = ParsedAssignmentRow & {
  rowNumber: number;
  errors: string[];
  warnings?: string[];
};

type PreviewSummary = {
  newCount: number;
  duplicateCount: number;
  errorCount: number;
  validCount: number;
};

const MAP_FIELDS: { key: keyof AssignmentColumnMap; label: string }[] = [
  { key: "teacher_first_name", label: "שם פרטי מורה" },
  { key: "teacher_last_name", label: "שם משפחה מורה" },
  { key: "subject", label: "מקצוע" },
  { key: "lesson_name", label: "שם שיעור" },
  { key: "grade_level", label: "שכבה" },
  { key: "assignment_category_raw", label: "סוג שיבוץ" },
  { key: "class_name", label: "כיתה" },
  { key: "specialization_name", label: "התמחות" },
  { key: "track_name", label: "מסלול" },
  { key: "psychology_raw", label: "פסיכולוגיה" },
  { key: "teaching_mode_raw", label: "סוג הוראה" },
];

function targetPreview(r: PreviewRow): string {
  const cat = r.assignment_category_raw?.trim();
  const parts = [
    cat && `סוג: ${cat}`,
    r.class_name && `כיתה: ${r.class_name}`,
    r.specialization_name && `התמחות: ${r.specialization_name}`,
    r.track_name && `מסלול: ${r.track_name}`,
    r.psychology_raw && "פסיכולוגיה",
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

export function ImportAssignmentsClient() {
  const router = useRouter();
  const { viewingYear, readOnly } = useAcademicYear();

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ rowNumber: number; errors: string[] }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<AssignmentColumnMap>({});
  const [showMapping, setShowMapping] = useState(false);

  const activeHint = viewingYear ? `שנה: ${viewingYear.year_name}${readOnly ? " (ארכיון)" : ""}` : "";

  const processFile = useCallback(
    async (file: File, map: AssignmentColumnMap = {}) => {
      setMessage(null);
      setBusy(true);
      setRows(null);
      setSummary(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (Object.keys(map).length) fd.set("column_map", JSON.stringify(map));
        const r = await fetch(
          withYearQuery("/api/teacher-assignments/import/preview", viewingYear?.id),
          { method: "POST", body: fd },
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const headers = (j as { headers?: string[] }).headers ?? [];
          if (headers.length) {
            setExcelHeaders(headers);
            setShowMapping(true);
            setPendingFile(file);
          }
          throw new Error((j as { error?: string }).error ?? "שגיאה");
        }
        setRows((j as { rows: PreviewRow[] }).rows ?? []);
        setValidCount((j as { validCount: number }).validCount ?? 0);
        setErrorCount((j as { errorCount: number }).errorCount ?? 0);
        setSummary((j as { summary?: PreviewSummary }).summary ?? null);
        setShowMapping(false);
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [viewingYear?.id],
  );

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setPendingFile(file);
      setColumnMap({});
      void processFile(file);
    },
    [processFile],
  );

  async function commit() {
    if (!rows?.length) return;
    setBusy(true);
    setMessage(null);
    setImportErrors([]);
    try {
      const payload = rows
        .filter((r) => r.errors.length === 0)
        .map((r) => ({
          rowNumber: r.rowNumber,
          teacher_first_name: r.teacher_first_name,
          teacher_last_name: r.teacher_last_name,
          subject: r.subject,
          lesson_name: r.lesson_name,
          grade_level: r.grade_level,
          assignment_category_raw: r.assignment_category_raw,
          class_name: r.class_name,
          specialization_name: r.specialization_name,
          track_name: r.track_name,
          psychology_raw: r.psychology_raw,
          teaching_mode_raw: r.teaching_mode_raw,
        }));
      const r = await fetch(
        withYearQuery("/api/teacher-assignments/import/commit", viewingYear?.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: payload, skipDuplicates: true }),
        },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setImportErrors((j as { errors?: { rowNumber: number; errors: string[] }[] }).errors ?? []);
        throw new Error((j as { error?: string }).error ?? "שגיאה");
      }
      const imported = (j as { imported?: number }).imported ?? 0;
      const skippedDuplicates = (j as { skippedDuplicates?: number }).skippedDuplicates ?? 0;
      const failed = (j as { failed?: number }).failed ?? 0;
      setMessage(
        `ייבוא הושלם: נוספו ${imported} שיבוצים` +
          (skippedDuplicates ? `, דולגו ${skippedDuplicates} כפולים` : "") +
          (failed ? `, נכשלו ${failed}` : "") +
          ".",
      );
      setRows(null);
      setSummary(null);
      setValidCount(0);
      setErrorCount(0);
      setConfirmOpen(false);
      if (imported > 0) router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const confirmHint = summary
    ? `חדשים: ${summary.newCount} · כפולים (ידולגו): ${summary.duplicateCount} · תקינים: ${summary.validCount}`
    : validCount > 0
      ? `${validCount} שורות תקינות`
      : "";

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="ייבוא שיבוצים מאקסל"
        subtitle="עמודות: כיתה / התמחות / מסלול / פסיכולוגיה — רק יעד אחד בכל שורה."
        actions={
          <>
            <a href="/api/teacher-assignments/import/template" className={LIST_SECONDARY_LINK_CLASS}>
              <FileDown className="size-4 shrink-0" strokeWidth={2} />
              תבנית
            </a>
            <Link href="/teachers" className={LIST_SECONDARY_LINK_CLASS}>
              מורות
            </Link>
            <Link href="/assignments" className={LIST_SECONDARY_LINK_CLASS}>
              <List className="size-4 shrink-0" strokeWidth={2} />
              חזרה
            </Link>
          </>
        }
      />

      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          שנה בארכיון — לא ניתן לייבא שיבוצים.
        </p>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center text-sm">
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-5" /> מעבד…
            </span>
          ) : (
            <>
              <span className="font-medium">בחרי קובץ Excel</span>
              {pendingFile ? <span className="text-xs text-emerald-800">{pendingFile.name}</span> : null}
            </>
          )}
        </label>
      )}

      {showMapping && excelHeaders.length ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm font-medium text-amber-900">מיפוי עמודות</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {MAP_FIELDS.map(({ key, label }) => (
              <label key={key} className="block text-sm">
                <span className="font-medium">{label}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                  value={columnMap[key] ?? ""}
                  onChange={(e) => setColumnMap((m) => ({ ...m, [key]: e.target.value || undefined }))}
                >
                  <option value="">— בחרי עמודה —</option>
                  {excelHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || !pendingFile}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            onClick={() => pendingFile && void processFile(pendingFile, columnMap)}
          >
            המשך לתצוגה מקדימה
          </button>
        </div>
      ) : null}

      {activeHint ? <p className="text-xs text-zinc-600">{activeHint}</p> : null}

      {message ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">{message}</p>
      ) : null}

      {importErrors.length ? (
        <ul className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {importErrors.slice(0, 12).map((e) => (
            <li key={e.rowNumber}>
              שורה {e.rowNumber}: {e.errors.join("; ")}
            </li>
          ))}
        </ul>
      ) : null}

      {rows ? (
        <div className="space-y-4">
          {summary ? (
            <div className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm sm:grid-cols-4">
              <div>
                <span className="text-zinc-500">חדשים</span>
                <div className="font-semibold text-emerald-800">{summary.newCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">כפולים</span>
                <div className="font-semibold text-sky-800">{summary.duplicateCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">תקינים</span>
                <div className="font-semibold">{summary.validCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">שגויים</span>
                <div className="font-semibold text-red-800">{summary.errorCount}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm">
              <span className="text-emerald-800">תקינים: {validCount}</span> ·{" "}
              <span className="text-red-800">שגויים: {errorCount}</span>
            </p>
          )}
          <Table className="min-w-[960px] text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>מורה</TableHead>
                <TableHead>מקצוע</TableHead>
                <TableHead>שם שיעור</TableHead>
                <TableHead>יעד</TableHead>
                <TableHead>שכבה</TableHead>
                <TableHead>הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rowNumber}>
                  <TableCell>{r.rowNumber}</TableCell>
                  <TableCell>
                    {r.teacher_first_name} {r.teacher_last_name}
                  </TableCell>
                  <TableCell>{r.subject || "—"}</TableCell>
                  <TableCell>{r.lesson_name || "—"}</TableCell>
                  <TableCell>{targetPreview(r)}</TableCell>
                  <TableCell>{r.grade_level}</TableCell>
                  <TableCell className="text-red-800">
                    {[...r.errors, ...(r.warnings ?? [])].join("; ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <button
            type="button"
            disabled={busy || readOnly || validCount === 0}
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            אישור ייבוא
          </button>
        </div>
      ) : null}

      <ConfirmDangerDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="אישור ייבוא שיבוצים"
        description="רק יעד אחד בכל שורה. כפולים יידלגו."
        hint={confirmHint}
        confirmLabel="ייבוא"
        busy={busy}
        onConfirm={commit}
      />
    </div>
  );
}
