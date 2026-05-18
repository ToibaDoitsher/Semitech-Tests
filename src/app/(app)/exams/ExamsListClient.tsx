"use client";

import Link from "next/link";
import { CalendarPlus, PenLine } from "lucide-react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_PRIMARY_LINK_CLASS,
  LIST_ROW_LINK_CLASS,
} from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import type { Teacher } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type ExamRow = {
  id: string;
  subject: string;
  exam_date: string;
  target_label?: string;
  teachers: Teacher | null;
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
    <div className="space-y-8">
      <ListPageHeader
        title="מבחנים"
        subtitle="רשימת מבחנים וקישור לעדכון — ייצוא נפרד לרשימת מבחנים ולשורות תלמידות"
        actions={
          <>
            <ExportExcelButton
              label="מבחנים לאקסל"
              filename="מבחנים"
              sheetName="מבחנים"
              exportUrl="/api/export/exams"
            />
            <ExportExcelButton
              label="תלמידות במבחנים"
              filename="מבחנים-תלמידות"
              sheetName="שורות"
              exportUrl="/api/export/exam-lines"
            />
            <Link href="/exams/new" className={LIST_PRIMARY_LINK_CLASS}>
              <CalendarPlus className="size-4 shrink-0" strokeWidth={2} />
              יצירת מבחן
            </Link>
          </>
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
            <span>{count} מבחנים</span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead>מורה</TableHead>
              <TableHead>מקצוע</TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>יעד</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.exams?.length ? (
              data.exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{teacherEmbedDisplayName(e.teachers as Teacher | null)}</TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">{e.subject}</TableCell>
                  <TableCell>{e.exam_date}</TableCell>
                  <TableCell className="text-slate-600 dark:text-zinc-300">
                    {e.target_label ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/exams/${e.id}`} className={LIST_ROW_LINK_CLASS}>
                      <PenLine className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                      עדכון מבחן
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={5}>
                  {isLoading ? "טוען…" : "אין מבחנים"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="מבחנים"
          count={count}
          apiPath="/api/exams/clear-all"
          scopePreviewPath="/api/scope/delete-preview"
          confirmHint="מחיקה רכה של מבחנים בזוג המחזורים הנבחר."
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}
