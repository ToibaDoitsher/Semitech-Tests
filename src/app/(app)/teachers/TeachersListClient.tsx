"use client";

import Link from "next/link";
import useSWR from "swr";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import type { Teacher } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

export function TeachersListClient() {
  const { data, error, isLoading, mutate } = useSWR<{ teachers: Teacher[] }>("/api/teachers", fetcher);
  const count = data?.teachers?.length ?? 0;

  async function removeTeacher(id: string) {
    if (!confirm("למחוק מורה? ייתכן שתישארנה תלויות בשיבוצים ובמבחנים.")) return;
    const r = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">מורות</h1>
          <p className="mt-1 text-sm text-zinc-600">ניהול מורות</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportExcelButton
            label="ייצוא לאקסל"
            filename="מורות"
            sheetName="מורות"
            exportUrl="/api/export/teachers"
          />
          <Link
            href="/teachers/new"
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            הוספת מורה
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {isLoading ? (
          <>
            <Spinner className="size-4" />
            טוען…
          </>
        ) : error ? (
          <span className="text-red-700">{(error as Error).message}</span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-right text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data?.teachers?.length ? (
              data.teachers.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/teachers/${t.id}/edit`} className="text-xs font-medium text-sky-700 hover:underline">
                        עריכה
                      </Link>
                      <button
                        type="button"
                        className="text-xs font-medium text-red-700 hover:underline"
                        onClick={() => void removeTeacher(t.id)}
                      >
                        מחיקה
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={2}>
                  {isLoading ? "טוען…" : "אין מורות"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TableClearFooter
          label="מורות"
          count={count}
          apiPath="/api/teachers/clear-all"
          confirmHint="יימחקו קודם כל המבחנים במערכת (כולל מעקב והשלמות), ואז כל המורות והשיבוצים."
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}
