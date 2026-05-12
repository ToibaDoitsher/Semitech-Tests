"use client";

import Link from "next/link";
import useSWR from "swr";
import { MakeupStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Row = {
  id: string;
  student_id: string;
  exam_id: string;
  status: string;
  created_at: string;
  student: { first_name: string; last_name: string; tz: string } | null;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

export function MakeupsClient() {
  const { data, error, isLoading, mutate } = useSWR<{ makeups: Row[] }>("/api/makeups", fetcher);
  const count = data?.makeups?.length ?? 0;

  async function complete(id: string) {
    if (!confirm("לסמן השלמה כהושלמה?")) return;
    const r = await fetch(`/api/makeups/${id}/complete`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "עדכון נכשל");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">השלמות</h1>
          <p className="mt-1 text-sm text-zinc-600">מבחנים חסרים — סימון השלמה מעדכן גם את סטטוס המבחן</p>
        </div>
        <ExportExcelButton
          label="ייצוא לאקסל (כל ההשלמות)"
          filename="השלמות"
          sheetName="השלמות"
          exportUrl="/api/export/makeups"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {isLoading ? (
          <>
            <Spinner className="size-4" />
            טוען…
          </>
        ) : error ? (
          <span className="text-red-700">{(error as Error).message}</span>
        ) : (
          <span>{data?.makeups?.length ?? 0} פתוחות</span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-right text-zinc-600">
            <tr>
              <th className="px-4 py-3 font-medium">תלמידה</th>
              <th className="px-4 py-3 font-medium">מבחן</th>
              <th className="px-4 py-3 font-medium">תאריך</th>
              <th className="px-4 py-3 font-medium">מורה</th>
              <th className="px-4 py-3 font-medium">סטטוס</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data?.makeups?.length ? (
              data.makeups.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50/80">
                  <td className="px-4 py-3 font-medium">
                    {m.student ? `${m.student.last_name} ${m.student.first_name}` : "—"}
                  </td>
                  <td className="px-4 py-3">{m.exam?.subject ?? "—"}</td>
                  <td className="px-4 py-3">{m.exam?.exam_date ?? "—"}</td>
                  <td className="px-4 py-3">{m.exam?.teacher_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <MakeupStatusBadge status={m.status as "open" | "completed"} />
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link href={`/students/${m.student_id}`} className="text-xs text-sky-700 hover:underline">
                        כרטיס תלמידה
                      </Link>
                      <Link href={`/exams/${m.exam_id}`} className="text-xs text-sky-700 hover:underline">
                        למבחן
                      </Link>
                      {m.status === "open" ? (
                        <button
                          type="button"
                          className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100"
                          onClick={() => void complete(m.id)}
                        >
                          סימון השלמה
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={6}>
                  {isLoading ? "טוען…" : "אין השלמות פתוחות"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TableClearFooter
          label="רשומות השלמה"
          count={count}
          apiPath="/api/makeups/clear-all"
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}
