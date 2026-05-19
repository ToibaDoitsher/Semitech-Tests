"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_PRIMARY_LINK_CLASS,
  LIST_ROW_DELETE_CLASS,
  LIST_ROW_LINK_CLASS,
} from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { teacherDisplayName } from "@/lib/teachers/display";
import type { Teacher } from "@/lib/types/db";

import { apiFetcher } from "@/lib/api/fetcher";

export function TeachersListClient() {
  const { viewingYear } = useAcademicYear();
  const [q, setQ] = useState("");
  const deferred = useDeferredValue(q.trim());
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (deferred) p.set("q", deferred);
    const qs = p.toString();
    return withYearQuery(`/api/teachers${qs ? `?${qs}` : ""}`, viewingYear?.id);
  }, [deferred, viewingYear?.id]);

  const { data, error, isLoading, mutate } = useSWR<{ teachers: Teacher[] }>(url, apiFetcher);
  const count = data?.teachers?.length ?? 0;

  async function removeTeacher(id: string) {
    if (!confirm("למחוק מורה? השיבוצים והמבחנים הקיימים יישארו — המורה תוסתר מהרשימה.")) return;
    const r = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="מורות"
        subtitle="פרטי מורה נשמרים פעם אחת — שיבוצים ומבחנים מקושרים למורה קיימת"
        actions={
          <>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="מורות"
              sheetName="מורות"
              exportUrl="/api/export/teachers"
            />
            <Link
              href="/teachers/import"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200"
            >
              <Upload className="size-4 shrink-0 opacity-80" strokeWidth={2} />
              ייבוא מאקסל
            </Link>
            <Link href="/teachers/new" className={LIST_PRIMARY_LINK_CLASS}>
              <Plus className="size-4 shrink-0" strokeWidth={2} />
              הוספת מורה
            </Link>
          </>
        }
      />

      <ListDataCard>
        <ListTableToolbar>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש: שם, ת״ז, מייל…"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-500/25 dark:border-zinc-600 dark:bg-zinc-950/40"
          />
          <div className="mt-3">
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                טוען…
              </span>
            ) : error ? (
              <span className="text-red-600">{(error as Error).message}</span>
            ) : (
              <span>{count} מורות ברשימה</span>
            )}
          </div>
        </ListTableToolbar>
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>ת״ז</TableHead>
              <TableHead>מייל</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.teachers?.length ? (
              data.teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">
                    {teacherDisplayName(t)}
                  </TableCell>
                  <TableCell>{t.tz ?? "—"}</TableCell>
                  <TableCell>{t.email ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={`/teachers/${t.id}/edit`} className={LIST_ROW_LINK_CLASS}>
                        <Pencil className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                        עריכה
                      </Link>
                      <button
                        type="button"
                        className={LIST_ROW_DELETE_CLASS}
                        onClick={() => void removeTeacher(t.id)}
                      >
                        <Trash2 className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
                        מחיקה
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={4}>
                  {isLoading ? "טוען…" : "אין מורות"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="מורות"
          count={count}
          apiPath={withYearQuery("/api/teachers/clear-all", viewingYear?.id)}
          confirmHint="כל המורות של שנת הלימודים הנבחרת יוסתרו מהרשימה (מחיקה רכה)."
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}
