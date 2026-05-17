"use client";

import Link from "next/link";
import { Pencil, Plus, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_PRIMARY_LINK_CLASS,
  LIST_ROW_LINK_CLASS,
  LIST_SECONDARY_LINK_CLASS,
} from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { pickLookupName } from "@/lib/lookups/display";
import type { Student } from "@/lib/types/db";

const filterControlClass =
  "mt-1.5 w-full rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-500/25 dark:border-zinc-600 dark:bg-zinc-950/40 dark:focus:ring-blue-400/20";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאת טעינה");
  return j;
};

export function StudentsListClient() {
  const [q, setQ] = useState("");
  const [cohortGrade, setCohortGrade] = useState("");
  const [classId, setClassId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [trackId, setTrackId] = useState("");
  const deferred = useDeferredValue(q);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (deferred.trim()) p.set("q", deferred.trim());
    if (cohortGrade) p.set("grade_level", cohortGrade === "A" ? "א" : cohortGrade === "B" ? "ב" : cohortGrade);
    if (classId) p.set("class_id", classId);
    if (specializationId) p.set("specialization_id", specializationId);
    if (trackId) p.set("track_id", trackId);
    const qs = p.toString();
    return `/api/students${qs ? `?${qs}` : ""}`;
  }, [deferred, cohortGrade, classId, specializationId, trackId]);

  const { data, error, isLoading, mutate } = useSWR<{ students: Student[] }>(url, fetcher);
  const count = data?.students?.length ?? 0;

  const { data: clData } = useSWR<{ items: { id: string; name: string }[] }>("/api/lookups/classes", fetcher);
  const { data: spData } = useSWR<{ items: { id: string; name: string }[] }>("/api/lookups/specializations", fetcher);
  const { data: trData } = useSWR<{ items: { id: string; name: string }[] }>("/api/lookups/tracks", fetcher);

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="תלמידות"
        subtitle="חיפוש חי: מילה אחת (שם או ת״ז), או שם פרטי ואז רווח ואז שם משפחה — גם בסדר הפוך (משפחה רווח פרטי)"
        actions={
          <>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="תלמידות"
              sheetName="תלמידות"
              exportUrl="/api/export/students"
            />
            <Link href="/students/import" className={LIST_SECONDARY_LINK_CLASS}>
              <Upload className="size-4 shrink-0" strokeWidth={2} />
              ייבוא מאקסל
            </Link>
            <Link href="/students/new" className={LIST_PRIMARY_LINK_CLASS}>
              <Plus className="size-4 shrink-0" strokeWidth={2} />
              הוספת תלמידה
            </Link>
          </>
        }
      />

      <ListDataCard>
        <div className="bg-gradient-to-bl from-slate-50/95 via-white to-sky-50/35 p-5 sm:p-6 dark:from-slate-900/50 dark:via-zinc-900/35 dark:to-slate-900/25">
          <div className="mb-4 flex flex-col gap-2 border-b border-slate-200/60 pb-4 dark:border-slate-700/50 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">סינון תוצאות</p>
            {(cohortGrade || classId || trackId || specializationId) ? (
              <button
                type="button"
                className="self-start text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline dark:text-blue-300"
                onClick={() => {
                  setCohortGrade("");
                  setClassId("");
                  setSpecializationId("");
                  setTrackId("");
                }}
              >
                ניקוי סינון
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block sm:col-span-2 lg:col-span-2">
              <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">חיפוש</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="למשל: יעל כהן · או כהן יעל · או ת״ז…"
                className={filterControlClass}
                dir="rtl"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">שכבה</span>
              <select
                value={cohortGrade}
                onChange={(e) => setCohortGrade(e.target.value)}
                className={filterControlClass}
              >
                <option value="">הכל</option>
                <option value="א">א</option>
                <option value="ב">ב</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">כיתה</span>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className={filterControlClass}
              >
                <option value="">הכל</option>
                {(clData?.items ?? []).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">מסלול</span>
              <select
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                className={filterControlClass}
              >
                <option value="">הכל</option>
                {(trData?.items ?? []).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">התמחות</span>
              <select
                value={specializationId}
                onChange={(e) => setSpecializationId(e.target.value)}
                className={filterControlClass}
              >
                <option value="">הכל</option>
                {(spData?.items ?? []).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
            <span>{data?.students?.length ?? 0} תוצאות</span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>ת״ז</TableHead>
              <TableHead>שכבה</TableHead>
              <TableHead>כיתה</TableHead>
              <TableHead>מסלול</TableHead>
              <TableHead>התמחות</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.students?.length ? (
              data.students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/students/${s.id}`}
                      className="text-slate-900 underline-offset-2 hover:text-blue-800 hover:underline dark:text-zinc-100 dark:hover:text-blue-300"
                    >
                      {s.last_name} {s.first_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-left font-mono text-xs" dir="ltr">
                    {s.tz}
                  </TableCell>
                  <TableCell>
                    {formatCohortGradeLabel(s.grade_level)} · מחזור {s.cohort_number}
                  </TableCell>
                  <TableCell>{pickLookupName(s.classes)}</TableCell>
                  <TableCell>{pickLookupName(s.tracks)}</TableCell>
                  <TableCell>{pickLookupName(s.specializations)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/students/${s.id}/edit`} className={LIST_ROW_LINK_CLASS}>
                      <Pencil className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                      עריכה
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={7}>
                  {isLoading ? "טוען…" : "אין תלמידות להצגה"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="תלמידות"
          count={count}
          apiPath="/api/students/clear-all"
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}
