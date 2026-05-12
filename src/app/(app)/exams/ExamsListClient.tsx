"use client";

import Link from "next/link";
import useSWR from "swr";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type ExamRow = {
  id: string;
  subject: string;
  exam_date: string;
  target_type: string;
  target_id: string;
  target_label?: string;
  teachers: { name: string } | null;
};

const targetLabel: Record<string, string> = {
  class: "כיתה",
  specialization: "התמחות",
  track: "מסלול",
};

export function ExamsListClient() {
  const { data, error, isLoading, mutate } = useSWR<{ exams: ExamRow[] }>("/api/exams", fetcher);
  const count = data?.exams?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">מבחנים</h1>
          <p className="mt-1 text-sm text-zinc-600">רשימת מבחנים וקישור לעדכון</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportExcelButton
            label="מבחנים לאקסל"
            filename="מבחנים"
            sheetName="מבחנים"
            exportUrl="/api/export/exams"
          />
          <ExportExcelButton
            label="תלמידות במבחנים (סטטוס)"
            filename="מבחנים-תלמידות"
            sheetName="שורות"
            exportUrl="/api/export/exam-lines"
          />
          <Link
            href="/exams/new"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:opacity-95"
          >
            יצירת מבחן
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

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-md">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-right text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">מורה</th>
              <th className="px-4 py-3 font-medium">מקצוע</th>
              <th className="px-4 py-3 font-medium">תאריך</th>
              <th className="px-4 py-3 font-medium">יעד</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data?.exams?.length ? (
              data.exams.map((e) => (
                <tr key={e.id} className="hover:bg-violet-50/30">
                  <td className="px-4 py-3">{e.teachers?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{e.subject}</td>
                  <td className="px-4 py-3">{e.exam_date}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {targetLabel[e.target_type] ?? e.target_type}: {e.target_label ?? e.target_id}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Link href={`/exams/${e.id}`} className="text-xs font-medium text-violet-700 hover:underline">
                      עדכון מבחן
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={5}>
                  {isLoading ? "טוען…" : "אין מבחנים"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TableClearFooter
          label="מבחנים"
          count={count}
          apiPath="/api/exams/clear-all"
          confirmHint="יימחקו כל המבחנים, שורות תלמידות במבחן, השלמות ושורות מעקב הקשורות למבחנים."
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}
