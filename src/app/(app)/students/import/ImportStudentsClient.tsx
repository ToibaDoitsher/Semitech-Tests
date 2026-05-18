"use client";

import Link from "next/link";
import { FileDown, List } from "lucide-react";
import { useCallback, useState } from "react";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ColumnMap, ParsedImportRow } from "@/lib/students/excelImport";

type PreviewRow = ParsedImportRow & {
  rowNumber: number;
  errors: string[];
  warnings?: string[];
};

type PreviewSummary = {
  newCount: number;
  updateCount: number;
  duplicateTz: number;
  errorCount: number;
  validCount: number;
};

const MAP_FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "first_name", label: "שם פרטי" },
  { key: "last_name", label: "שם משפחה" },
  { key: "tz", label: "תעודת זהות" },
  { key: "class_name", label: "כיתה" },
  { key: "specialization", label: "התמחות" },
  { key: "track", label: "מסלול" },
  { key: "secondary_specialization", label: "התמחות נוספת" },
  { key: "psychology", label: "פסיכולוגיה" },
  { key: "teaching_track_type", label: "הוראה מקוצר" },
  { key: "year_group", label: "שנתון" },
  { key: "grade_level", label: "שכבה" },
];

export function ImportStudentsClient() {
  const { viewingYear, readOnly } = useAcademicYear();

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ rowNumber: number; errors: string[] }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [showMapping, setShowMapping] = useState(false);

  const activeHint = viewingYear ? `שנה: ${viewingYear.year_name}${readOnly ? " (ארכיון)" : ""}` : "";

  const processFile = useCallback(
    async (file: File, map: ColumnMap = {}) => {
      setMessage(null);
      setBusy(true);
      setRows(null);
      setSummary(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (Object.keys(map).length) fd.set("column_map", JSON.stringify(map));
        const r = await fetch(withYearQuery("/api/students/import/preview", viewingYear?.id), {
          method: "POST",
          body: fd,
        });
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
          first_name: r.first_name,
          last_name: r.last_name,
          tz: r.tz,
          class_name: r.class_name,
          specialization: r.specialization,
          track: r.track,
          secondary_specialization: r.secondary_specialization,
          psychology: r.psychology,
          teaching_track_type: r.teaching_track_type,
          year_group: r.year_group,
          grade_level: r.grade_level,
        }));
      const r = await fetch(withYearQuery("/api/students/import/commit", viewingYear?.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, updateExisting }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setImportErrors((j as { errors?: { rowNumber: number; errors: string[] }[] }).errors ?? []);
        throw new Error((j as { error?: string }).error ?? "שגיאה");
      }
      setMessage(
        `ייבוא הושלם: יובאו ${(j as { imported?: number }).imported ?? 0}, עודכנו ${(j as { updated?: number }).updated ?? 0}, נכשלו ${(j as { failed?: number }).failed ?? 0}`,
      );
      setRows(null);
      setSummary(null);
      setValidCount(0);
      setErrorCount(0);
      setConfirmOpen(false);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const confirmHint = summary
    ? `חדשות: ${summary.newCount} · עדכון לפי ת״ז: ${summary.updateCount} · סה״כ תקינות: ${summary.validCount}`
    : validCount > 0
      ? `${validCount} שורות ייובאו לשנה הנוכחית`
      : "";

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="ייבוא תלמידות מאקסל"
        subtitle="הורידי את התבנית — עמודות קבועות כולל שנתון ושכבה לכל שורה."
        actions={
          <>
            <a href="/api/students/import/template" className={LIST_SECONDARY_LINK_CLASS}>
              <FileDown className="size-4 shrink-0" strokeWidth={2} />
              תבנית
            </a>
            <Link href="/settings/academic-years" className={LIST_SECONDARY_LINK_CLASS}>
              שנות לימוד
            </Link>
            <Link href="/students" className={LIST_SECONDARY_LINK_CLASS}>
              <List className="size-4 shrink-0" strokeWidth={2} />
              חזרה
            </Link>
          </>
        }
      />


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

      {showMapping && excelHeaders.length ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-sm font-medium text-amber-900">מיפוי עמודות — התאימי עמודות הקובץ לשדות המערכת</p>
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
                <span className="text-zinc-500">חדשות</span>
                <div className="font-semibold text-emerald-800">{summary.newCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">יעדכנו</span>
                <div className="font-semibold text-sky-800">{summary.updateCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">תקינות</span>
                <div className="font-semibold">{summary.validCount}</div>
              </div>
              <div>
                <span className="text-zinc-500">שגויות</span>
                <div className="font-semibold text-red-800">{summary.errorCount}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm">
              <span className="text-emerald-800">תקינות: {validCount}</span> ·{" "}
              <span className="text-red-800">שגויות: {errorCount}</span>
            </p>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            עדכן לפי ת״ז
          </label>
          <Table className="min-w-[960px] text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>שם</TableHead>
                <TableHead>ת״ז</TableHead>
                <TableHead>כיתה</TableHead>
                <TableHead>מסלול</TableHead>
                <TableHead>שנתון</TableHead>
                <TableHead>שכבה</TableHead>
                <TableHead>הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rowNumber}>
                  <TableCell>{r.rowNumber}</TableCell>
                  <TableCell>
                    {r.first_name} {r.last_name}
                  </TableCell>
                  <TableCell dir="ltr">{r.tz}</TableCell>
                  <TableCell>{r.class_name}</TableCell>
                  <TableCell>{r.track}</TableCell>
                  <TableCell>{r.year_group}</TableCell>
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
            disabled={busy || validCount === 0}
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
        title="אישור ייבוא"
        description="השנתון והשכבה לכל תלמידה נלקחים מעמודות «שנתון» ו«שכבה» בקובץ."
        hint={confirmHint}
        confirmLabel="ייבוא"
        busy={busy}
        onConfirm={commit}
      />
    </div>
  );
}
