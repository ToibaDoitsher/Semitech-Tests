"use client";

import Link from "next/link";
import { FileDown, List } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

type ImportPlan = {
  academicYearName: string;
  cohortNumber: number;
  targetGrade: string | null;
  willImportCount: number;
};

type PreviewRow = {
  rowNumber: number;
  first_name: string;
  last_name: string;
  tz: string;
  class_name: string;
  specialization: string;
  track: string;
  errors: string[];
  warnings?: string[];
};

type YearOption = { name: string };

export function ImportStudentsClient() {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [academicYearName, setAcademicYearName] = useState("");
  const [years, setYears] = useState<YearOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<{ rowNumber: number; errors: string[] }[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/academic-years");
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return;
        const list = (j as { years?: YearOption[] }).years ?? [];
        setYears(list);
        const active = list.find((y) => (y as { is_active?: boolean }).is_active) ?? list[0];
        if (active?.name) setAcademicYearName((prev) => prev.trim() || active.name);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const processFile = useCallback(async (file: File) => {
    setMessage(null);
    setBusy(true);
    setRows(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/students/import/preview", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setRows((j as { rows: PreviewRow[] }).rows ?? []);
      setValidCount((j as { validCount: number }).validCount ?? 0);
      setErrorCount((j as { errorCount: number }).errorCount ?? 0);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      setPendingFile(null);
    }
  }, []);

  const onFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      setPendingFile(file);
      void processFile(file);
    },
    [processFile],
  );

  const yearCohortReady = Boolean(cohortName.trim() && academicYearName.trim());

  async function openConfirm() {
    if (!rows?.length || validCount === 0) return;
    if (!yearCohortReady) {
      setMessage("לפני ייבוא: בחרי שנת לימודים ומחזור יעד");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/students/import/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_number: cohortName.trim(),
          academic_year_name: academicYearName.trim(),
          valid_count: validCount,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setPlan((j as { plan: ImportPlan }).plan);
      setConfirmOpen(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!rows?.length) return;
    setBusy(true);
    setMessage(null);
    setImportErrors([]);
    try {
      const payload = rows.map((r) => ({
        rowNumber: r.rowNumber,
        first_name: r.first_name,
        last_name: r.last_name,
        tz: r.tz,
        class_name: r.class_name,
        specialization: r.specialization,
        track: r.track,
      }));
      const r = await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: payload,
          updateExisting,
          cohort_number: cohortName.trim(),
          academic_year_name: academicYearName.trim(),
        }),
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
      setValidCount(0);
      setErrorCount(0);
      setConfirmOpen(false);
      setPlan(null);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const planHint = plan
    ? [
        `שנה: ${plan.academicYearName}`,
        `מחזור ${plan.cohortNumber} → שכבה ${plan.targetGrade ?? "—"}`,
        `ייובאו ${plan.willImportCount} תלמידות`,
      ].join("\n")
    : "";

  const selectedYear = years.find((y) => y.name === academicYearName);

  return (
    <div className="space-y-8">
        <ListPageHeader
          title="ייבוא תלמידות מאקסל"
          subtitle="העלי קובץ Excel. שנה ומחזור נדרשים לאישור הסופי בלבד."
          actions={
            <>
              <a href="/api/students/import/template" className={LIST_SECONDARY_LINK_CLASS}>
                <FileDown className="size-4 shrink-0" strokeWidth={2} />
                תבנית
              </a>
              <Link href="/settings/open-year" className={LIST_SECONDARY_LINK_CLASS}>
                פתיחת שנה
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

        <div className="grid max-w-lg gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs text-zinc-600">
            {!years.length ? (
              <>
                אין שנות לימודים —{" "}
                <Link href="/settings/open-year" className="underline">
                  פתחי שנה
                </Link>
              </>
            ) : (
              "בחרי שנה ומחזור יעד (לפני אישור ייבוא)"
            )}
          </p>
          <label className="block text-sm">
            <span className="font-medium">שנת לימודים</span>
            <select
              value={academicYearName}
              onChange={(e) => setAcademicYearName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            >
              <option value="">— בחרי —</option>
              {years.map((y) => (
                <option key={y.name} value={y.name}>
                  {y.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">מחזור יעד</span>
            <input
              value={cohortName}
              onChange={(e) => setCohortName(e.target.value)}
              placeholder="10"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
            />
          </label>
        </div>

        {message ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">{message}</p>
        ) : null}

        {rows ? (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="text-emerald-800">תקינות: {validCount}</span> ·{" "}
              <span className="text-red-800">שגויות: {errorCount}</span>
            </p>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              עדכן לפי ת״ז
            </label>
            <Table className="min-w-[800px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>שם</TableHead>
                  <TableHead>ת״ז</TableHead>
                  <TableHead>כיתה</TableHead>
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
                    <TableCell className="text-red-800">{r.errors.join("; ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <button
              type="button"
              disabled={busy || validCount === 0 || !yearCohortReady}
              onClick={() => void openConfirm()}
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
          description="שיוך תלמידות לשנה ולמחזור שנבחרו."
          hint={planHint}
          confirmLabel="ייבוא"
          busy={busy}
          onConfirm={commit}
        />
    </div>
  );
}
