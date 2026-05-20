"use client";

import Link from "next/link";
import { FileDown, List } from "lucide-react";
import { useCallback, useState } from "react";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ENTITY_LABELS, type LookupEntitySlug } from "@/lib/lookups/entities";
import { isYearScopedLookup } from "@/lib/lookups/yearScope";
import type { LookupColumnMap, ValidatedLookupRow } from "@/lib/lookups/excelImport";
import { LOOKUP_EXCEL_HEADER } from "@/lib/lookups/excelTemplate";

type PreviewSummary = {
  newCount: number;
  duplicateCount: number;
  errorCount: number;
  validCount: number;
};

export function ImportLookupsClient({ entity }: { entity: LookupEntitySlug }) {
  const { viewingYear } = useAcademicYear();
  const title = ENTITY_LABELS[entity];
  const apiBase = `/api/lookups/${entity}/import`;
  const yearId = viewingYear?.id;

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ValidatedLookupRow[] | null>(null);
  const [summary, setSummary] = useState<PreviewSummary | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ rowNumber: number; errors: string[] }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<LookupColumnMap>({});
  const [showMapping, setShowMapping] = useState(false);

  const scopedUrl = useCallback(
    (path: string) => (isYearScopedLookup(entity) ? withYearQuery(path, yearId) : path),
    [entity, yearId],
  );

  const processFile = useCallback(
    async (file: File, map: LookupColumnMap = {}) => {
      setMessage(null);
      setBusy(true);
      setRows(null);
      setSummary(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (Object.keys(map).length) fd.set("column_map", JSON.stringify(map));
        const r = await fetch(scopedUrl(`${apiBase}/preview`), { method: "POST", body: fd });
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
        setRows((j as { rows: ValidatedLookupRow[] }).rows ?? []);
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
    [apiBase, scopedUrl],
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
        .map((r) => ({ rowNumber: r.rowNumber, name: r.name }));
      const r = await fetch(scopedUrl(`${apiBase}/commit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, skipDuplicates: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setImportErrors((j as { errors?: { rowNumber: number; errors: string[] }[] }).errors ?? []);
        throw new Error((j as { error?: string }).error ?? "שגיאה");
      }
      const imported = (j as { imported?: number }).imported ?? 0;
      const skippedDuplicates = (j as { skippedDuplicates?: number }).skippedDuplicates ?? 0;
      const failed = (j as { failed?: number }).failed ?? 0;
      setMessage(
        `ייבוא הושלם: נוספו ${imported} רשומות` +
          (skippedDuplicates ? `, דולגו ${skippedDuplicates} כפולים` : "") +
          (failed ? `, נכשלו ${failed}` : "") +
          ".",
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
    ? `חדשות: ${summary.newCount} · כפולים (ידולגו): ${summary.duplicateCount} · תקינות: ${summary.validCount}`
    : validCount > 0
      ? `${validCount} שורות תקינות`
      : "";

  return (
    <div className="space-y-8">
      <ListPageHeader
        title={`ייבוא ${title} מאקסל`}
        subtitle={`עמודה אחת: «${LOOKUP_EXCEL_HEADER}». שורות כפולות או קיימות במערכת יידלגו.`}
        actions={
          <>
            <a href={scopedUrl(`${apiBase}/template`)} className={LIST_SECONDARY_LINK_CLASS}>
              <FileDown className="size-4 shrink-0" strokeWidth={2} />
              תבנית
            </a>
            <Link href={`/settings/${entity}`} className={LIST_SECONDARY_LINK_CLASS}>
              <List className="size-4 shrink-0" strokeWidth={2} />
              חזרה ל{title}
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
          <p className="text-sm font-medium text-amber-900">מיפוי עמודות</p>
          <label className="block text-sm">
            <span className="font-medium">{LOOKUP_EXCEL_HEADER}</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 sm:max-w-md"
              value={columnMap.name ?? ""}
              onChange={(e) => setColumnMap({ name: e.target.value || undefined })}
            >
              <option value="">— בחרי עמודה —</option>
              {excelHeaders.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !pendingFile || !columnMap.name}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            onClick={() => pendingFile && void processFile(pendingFile, columnMap)}
          >
            המשך לתצוגה מקדימה
          </button>
        </div>
      ) : null}

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
                <span className="text-zinc-500">כפולים</span>
                <div className="font-semibold text-sky-800">{summary.duplicateCount}</div>
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
          <Table className="min-w-[320px] text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{LOOKUP_EXCEL_HEADER}</TableHead>
                <TableHead>סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rowNumber}>
                  <TableCell>{r.rowNumber}</TableCell>
                  <TableCell>{r.name || "—"}</TableCell>
                  <TableCell className="max-w-[14rem] text-red-800">
                    {[...r.errors, ...(r.warnings ?? [])].join("; ") || "—"}
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
        title={`אישור ייבוא ${title}`}
        description="ערכים שכבר קיימים במערכת יידלגו."
        hint={confirmHint}
        confirmLabel="ייבוא"
        busy={busy}
        onConfirm={commit}
      />
    </div>
  );
}
