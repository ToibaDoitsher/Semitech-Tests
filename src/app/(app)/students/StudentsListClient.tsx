"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { pickLookupName } from "@/lib/lookups/display";
import type { Student } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

export function StudentsListClient() {
  const [q, setQ] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [classId, setClassId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [trackId, setTrackId] = useState("");
  const deferred = useDeferredValue(q);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (deferred.trim()) p.set("q", deferred.trim());
    if (gradeLevelId) p.set("grade_level_id", gradeLevelId);
    if (classId) p.set("class_id", classId);
    if (specializationId) p.set("specialization_id", specializationId);
    if (trackId) p.set("track_id", trackId);
    const qs = p.toString();
    return `/api/students${qs ? `?${qs}` : ""}`;
  }, [deferred, gradeLevelId, classId, specializationId, trackId]);

  const { data, error, isLoading, mutate } = useSWR<{ students: Student[] }>(url, fetcher);
  const count = data?.students?.length ?? 0;

  const { data: glData } = useSWR<{ items: { id: string; name: string }[] }>("/api/lookups/grade-levels", fetcher);
  const { data: clData } = useSWR<{ items: { id: string; name: string }[] }>("/api/lookups/classes", fetcher);
  const { data: spData } = useSWR<{ items: { id: string; name: string }[] }>("/api/lookups/specializations", fetcher);
  const { data: trData } = useSWR<{ items: { id: string; name: string }[] }>("/api/lookups/tracks", fetcher);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">תלמידות</h1>
          <p className="mt-1 text-sm text-zinc-600">
            חיפוש חי: מילה אחת (שם או ת״ז), או שם פרטי ואז רווח ואז שם משפחה — גם בסדר הפוך (משפחה רווח פרטי)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportExcelButton
            label="ייצוא לאקסל"
            filename="תלמידות"
            sheetName="תלמידות"
            exportUrl="/api/export/students"
          />
          <Link
            href="/students/import"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 ring-1 ring-transparent transition hover:bg-zinc-50 hover:shadow-md hover:ring-zinc-300 active:scale-[0.98]"
          >
            ייבוא מאקסל
          </Link>
          <Link
            href="/students/new"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 hover:shadow-md active:scale-[0.98]"
          >
            הוספת תלמידה
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="block text-sm font-medium text-zinc-700">חיפוש</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="למשל: יעל כהן · או כהן יעל · או ת״ז…"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-violet-400"
              dir="rtl"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-zinc-700">שכבה</span>
            <select
              value={gradeLevelId}
              onChange={(e) => setGradeLevelId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
            >
              <option value="">הכל</option>
              {(glData?.items ?? []).map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-zinc-700">כיתה</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
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
            <span className="block text-sm font-medium text-zinc-700">מסלול</span>
            <select
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
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
            <span className="block text-sm font-medium text-zinc-700">התמחות</span>
            <select
              value={specializationId}
              onChange={(e) => setSpecializationId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400"
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

        {(gradeLevelId || classId || trackId || specializationId) && (
          <div className="mt-3 text-xs text-zinc-600">
            <button
              type="button"
              className="text-violet-700 hover:underline"
              onClick={() => {
                setGradeLevelId("");
                setClassId("");
                setSpecializationId("");
                setTrackId("");
              }}
            >
              ניקוי סינון
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-md">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          {isLoading ? (
            <>
              <Spinner className="size-4" />
              טוען…
            </>
          ) : error ? (
            <span className="text-red-700">{(error as Error).message}</span>
          ) : (
            <span>{data?.students?.length ?? 0} תוצאות</span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-right text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium">ת״ז</th>
              <th className="px-4 py-3 font-medium">שכבה</th>
              <th className="px-4 py-3 font-medium">כיתה</th>
              <th className="px-4 py-3 font-medium">מסלול</th>
              <th className="px-4 py-3 font-medium">התמחות</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data?.students?.length ? (
              data.students.map((s) => (
                <tr key={s.id} className="hover:bg-violet-50/30">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/students/${s.id}`} className="text-zinc-900 hover:text-violet-700 hover:underline">
                      {s.last_name} {s.first_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                    {s.tz}
                  </td>
                  <td className="px-4 py-3">{pickLookupName(s.grade_levels)}</td>
                  <td className="px-4 py-3">{pickLookupName(s.classes)}</td>
                  <td className="px-4 py-3">{pickLookupName(s.tracks)}</td>
                  <td className="px-4 py-3">{pickLookupName(s.specializations)}</td>
                  <td className="px-4 py-3 text-left">
                    <Link
                      href={`/students/${s.id}/edit`}
                      className="text-xs font-medium text-violet-700 hover:underline"
                    >
                      עריכה
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={7}>
                  {isLoading ? "טוען…" : "אין תלמידות להצגה"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TableClearFooter
          label="תלמידות"
          count={count}
          apiPath="/api/students/clear-all"
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}
