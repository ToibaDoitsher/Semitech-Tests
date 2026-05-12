"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, UserRound } from "lucide-react";
import useSWR from "swr";
import { ListDataCard, ListPageHeader, ListTableToolbar, LIST_ROW_LINK_CLASS } from "@/components/ui/ListPage";
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
    <div className="space-y-8">
      <ListPageHeader
        title="השלמות"
        subtitle="מבחנים חסרים — סימון השלמה מעדכן גם את סטטוס המבחן"
        actions={
          <ExportExcelButton
            label="ייצוא לאקסל (כל ההשלמות)"
            filename="השלמות"
            sheetName="השלמות"
            exportUrl="/api/export/makeups"
          />
        }
      />

      <ListDataCard>
        <ListTableToolbar>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען…
            </span>
          ) : error ? (
            <span className="text-red-600">{(error as Error).message}</span>
          ) : (
            <span>{data?.makeups?.length ?? 0} רשומות</span>
          )}
        </ListTableToolbar>
        <div className="overflow-x-auto">
          <table className="app-table min-w-[720px]">
            <thead>
              <tr>
                <th>תלמידה</th>
                <th>מבחן</th>
                <th>תאריך</th>
                <th>מורה</th>
                <th>סטטוס</th>
                <th className="w-[1%] whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {data?.makeups?.length ? (
                data.makeups.map((m) => (
                  <tr key={m.id}>
                    <td className="font-medium text-slate-900 dark:text-zinc-100">
                      {m.student ? `${m.student.last_name} ${m.student.first_name}` : "—"}
                    </td>
                    <td>{m.exam?.subject ?? "—"}</td>
                    <td>{m.exam?.exam_date ?? "—"}</td>
                    <td>{m.exam?.teacher_name ?? "—"}</td>
                    <td>
                      <MakeupStatusBadge status={m.status as "open" | "completed"} />
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link href={`/students/${m.student_id}`} className={LIST_ROW_LINK_CLASS}>
                          <UserRound className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                          כרטיס תלמידה
                        </Link>
                        <Link href={`/exams/${m.exam_id}`} className={LIST_ROW_LINK_CLASS}>
                          <BookOpen className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                          למבחן
                        </Link>
                        {m.status === "open" ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-900 dark:border-zinc-600 dark:bg-zinc-900/30 dark:hover:border-blue-500/40"
                            onClick={() => void complete(m.id)}
                          >
                            <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2} />
                            סימון השלמה
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={6}>
                    {isLoading ? "טוען…" : "אין השלמות פתוחות"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TableClearFooter
          label="רשומות השלמה"
          count={count}
          apiPath="/api/makeups/clear-all"
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}
