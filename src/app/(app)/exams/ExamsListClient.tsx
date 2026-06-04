"use client";

import Link from "next/link";
import { CalendarPlus, PenLine, Users } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_PRIMARY_LINK_CLASS,
} from "@/components/ui/ListPage";
import { ListFilterBar, matchesNameQuery } from "@/components/ui/ListFilterBar";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { NotesButton } from "@/components/ui/NotesButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { formatHebrewDateFromYmd } from "@/lib/hebrewDate";
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
  grade_levels?: string[];
  class_ids?: string[];
  track_ids?: string[];
  specialization_ids?: string[];
  psychology_enabled?: boolean;
  applies_to_all_in_grade?: boolean;
  assignment_category?: "חובה" | "התמחות";
  notes?: string | null;
  teachers: Teacher | null;
};

type LookupItem = { id: string; name: string };

export function ExamsListClient() {
  const { viewingYear, readOnly } = useAcademicYear();
  const url = withYearQuery("/api/exams", viewingYear?.id);
  const { data, error, isLoading, mutate } = useSWR<{ exams: ExamRow[] }>(url, fetcher);

  const { data: clData } = useSWR<{ items: LookupItem[] }>(
    withYearQuery("/api/lookups/classes", viewingYear?.id),
    fetcher,
  );
  const { data: spData } = useSWR<{ items: LookupItem[] }>(
    withYearQuery("/api/lookups/specializations", viewingYear?.id),
    fetcher,
  );
  const { data: trData } = useSWR<{ items: LookupItem[] }>(
    withYearQuery("/api/lookups/tracks", viewingYear?.id),
    fetcher,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);

  const allExams = data?.exams ?? [];
  const filteredExams = useMemo(() => {
    return allExams.filter((e) => {
      if (gradeFilter && !(e.grade_levels ?? []).includes(gradeFilter)) return false;
      if (classFilter && !(e.class_ids ?? []).includes(classFilter)) return false;
      if (trackFilter && !(e.track_ids ?? []).includes(trackFilter)) return false;
      if (specFilter && !(e.specialization_ids ?? []).includes(specFilter)) return false;
      if (categoryFilter && (e.assignment_category ?? "") !== categoryFilter) return false;
      if (deferredSearch.trim()) {
        const t = e.teachers;
        const matches = matchesNameQuery(deferredSearch, [
          t?.first_name,
          t?.last_name,
          (t as { full_name_generated?: string } | null)?.full_name_generated,
          e.subject,
          e.target_label,
        ]);
        if (!matches) return false;
      }
      return true;
    });
  }, [allExams, deferredSearch, gradeFilter, classFilter, trackFilter, specFilter, categoryFilter]);

  const totalCount = allExams.length;
  const count = filteredExams.length;
  const isFiltering = Boolean(
    deferredSearch.trim() ||
      gradeFilter ||
      classFilter ||
      trackFilter ||
      specFilter ||
      categoryFilter,
  );

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="מבחנים"
        subtitle="לכל מבחן: תלמידות וסטטוסים, או עריכת פרטי המבחן — ייצוא נפרד לרשימת מבחנים ולשורות תלמידות"
        actions={
          <>
            <ExportExcelButton
              label="מבחנים לאקסל"
              filename="מבחנים"
              sheetName="מבחנים"
              exportUrl={withYearQuery("/api/export/exams", viewingYear?.id)}
            />
            <ExportExcelButton
              label="תלמידות במבחנים"
              filename="מבחנים-תלמידות"
              sheetName="שורות"
              exportUrl={withYearQuery("/api/export/exam-lines", viewingYear?.id)}
            />
            {!readOnly ? (
              <Link href="/exams/new" className={LIST_PRIMARY_LINK_CLASS}>
                <CalendarPlus className="size-4 shrink-0" strokeWidth={2} />
                יצירת מבחן
              </Link>
            ) : null}
          </>
        }
      />

      <ListDataCard>
        <ListFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchLabel="חיפוש מבחן"
          searchPlaceholder="למשל: שרה כהן · גרפיקה · יא1…"
          searchHint="חיפוש לפי שם מורה (פרטי + משפחה) · מקצוע · יעד"
          filters={[
            {
              id: "category",
              label: "סוג שיבוץ",
              value: categoryFilter,
              onChange: setCategoryFilter,
              options: [
                { value: "חובה", label: "חובה" },
                { value: "התמחות", label: "התמחות" },
              ],
            },
            {
              id: "grade",
              label: "שכבה",
              value: gradeFilter,
              onChange: setGradeFilter,
              options: [
                { value: "א", label: "א" },
                { value: "ב", label: "ב" },
                { value: "ג", label: "ג" },
              ],
            },
            {
              id: "class",
              label: "כיתה",
              value: classFilter,
              onChange: setClassFilter,
              options: (clData?.items ?? []).map((it) => ({ value: it.id, label: it.name })),
            },
            {
              id: "track",
              label: "מסלול",
              value: trackFilter,
              onChange: setTrackFilter,
              options: (trData?.items ?? []).map((it) => ({ value: it.id, label: it.name })),
            },
            {
              id: "spec",
              label: "התמחות",
              value: specFilter,
              onChange: setSpecFilter,
              options: (spData?.items ?? []).map((it) => ({ value: it.id, label: it.name })),
            },
          ]}
          isAnyActive={isFiltering}
          onClearAll={() => {
            setSearchTerm("");
            setGradeFilter("");
            setClassFilter("");
            setTrackFilter("");
            setSpecFilter("");
            setCategoryFilter("");
          }}
        />
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
            <span>
              {count} מבחנים{isFiltering && count !== totalCount ? ` · מתוך ${totalCount}` : ""}
            </span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>מורה</TableHead>
              <TableHead>מקצוע</TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>יעד</TableHead>
              <TableHead>הערה</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-end">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExams.length ? (
              filteredExams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{teacherEmbedDisplayName(e.teachers as Teacher | null)}</TableCell>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">{e.subject}</TableCell>
                  <TableCell>{formatHebrewDateFromYmd(e.exam_date)}</TableCell>
                  <TableCell className="text-slate-600 dark:text-zinc-300">
                    {e.target_label ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <div className="flex flex-col gap-1.5">
                      {e.notes && e.notes.trim() ? (
                        <span
                          className="line-clamp-3 text-xs leading-snug text-amber-900 dark:text-amber-200"
                          title={e.notes}
                        >
                          {e.notes}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                      {!readOnly ? (
                        <NotesButton
                          entity="exams"
                          id={e.id}
                          compact
                          label={e.notes?.trim() ? "עריכת הערה" : "הוספת הערה"}
                          modalTitle={`הערה על המבחן — ${e.subject}`}
                          hasNote={Boolean(e.notes?.trim())}
                          onSaved={() => void mutate()}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Link
                        href={`/exams/${e.id}`}
                        title="תלמידות וסטטוסים במבחן"
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 transition hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-900/50"
                      >
                        <Users className="size-3.5 shrink-0 opacity-90" strokeWidth={2} />
                        תלמידות
                      </Link>
                      {!readOnly ? (
                        <Link
                          href={`/exams/${e.id}/edit`}
                          title="תאריך, מורה, יעד ושכבות"
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
                        >
                          <PenLine className="size-3.5 shrink-0 opacity-90" strokeWidth={2} />
                          עריכת מבחן
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={6}>
                  {isLoading ? "טוען…" : isFiltering ? "אין תוצאות תואמות לסינון" : "אין מבחנים"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {!readOnly ? (
          <TableClearFooter
            label="מבחנים"
            count={totalCount}
            apiPath={withYearQuery("/api/exams/clear-all", viewingYear?.id)}
            scopePreviewPath={withYearQuery("/api/scope/delete-preview", viewingYear?.id)}
            confirmHint="מחיקה רכה של מבחנים בשנה הנבחרת."
            onCleared={() => void mutate()}
          />
        ) : null}
      </ListDataCard>
    </div>
  );
}
