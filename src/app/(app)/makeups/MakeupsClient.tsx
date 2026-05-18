"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, UserRound } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { CompleteMakeupDialog } from "@/components/makeup/CompleteMakeupDialog";
import { ListDataCard, ListPageHeader, ListTableToolbar, LIST_ROW_LINK_CLASS } from "@/components/ui/ListPage";
import { MakeupStatusBadge } from "@/components/ui/StatusBadge";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  completed_at: string | null;
  grade: number | null;
  student: { first_name: string; last_name: string; tz: string } | null;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

function formatCompleted(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MakeupsClient() {
  const { data, error, isLoading, mutate } = useSWR<{ makeups: Row[] }>("/api/makeups", fetcher);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const count = data?.makeups?.length ?? 0;

  async function completeSave(payload: { completed_at: string; notes: string }) {
    if (!completeId) return;
    setCompleteBusy(true);
    try {
      const r = await fetch(`/api/makeups/${completeId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "עדכון נכשל");
      setCompleteId(null);
      await mutate();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCompleteBusy(false);
    }
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
            <span>{count} רשומות</span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>תלמידה</TableHead>
              <TableHead>מבחן</TableHead>
              <TableHead>תאריך מבחן</TableHead>
              <TableHead>מורה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>תאריך השלמה</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.makeups?.length ? (
              data.makeups.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.student ? `${m.student.last_name} ${m.student.first_name}` : "—"}
                  </TableCell>
                  <TableCell>{m.exam?.subject ?? "—"}</TableCell>
                  <TableCell>{m.exam?.exam_date ?? "—"}</TableCell>
                  <TableCell>{m.exam?.teacher_name ?? "—"}</TableCell>
                  <TableCell>
                    <MakeupStatusBadge status={m.status as "open" | "completed"} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatCompleted(m.completed_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
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
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium"
                          onClick={() => setCompleteId(m.id)}
                        >
                          <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2} />
                          הושלם
                        </button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center text-zinc-500">
                  {isLoading ? "טוען…" : "אין השלמות פתוחות"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="השלמות"
          count={count}
          apiPath="/api/makeups/clear-all"
          onCleared={() => void mutate()}
        />
      </ListDataCard>

      <CompleteMakeupDialog
        open={Boolean(completeId)}
        onClose={() => !completeBusy && setCompleteId(null)}
        busy={completeBusy}
        onSave={completeSave}
      />
    </div>
  );
}
