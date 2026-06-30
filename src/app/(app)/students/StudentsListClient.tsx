"use client";

import Link from "next/link";
import { Pencil, Plus, Printer, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_PRIMARY_LINK_CLASS,
  LIST_ROW_LINK_CLASS,
  LIST_IMPORT_LINK_CLASS,
} from "@/components/ui/ListPage";
import { ListFilterBar } from "@/components/ui/ListFilterBar";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { StudentCardsPrintConfirmDialog } from "@/components/students/StudentCardsPrintConfirmDialog";
import { printStudentCards } from "@/components/students/StudentCardPrintActions";
import type { StudentCardData } from "@/lib/students/loadStudentCardData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { pickLookupName } from "@/lib/lookups/display";
import { psychologyLabel } from "@/lib/students/display";
import { teachingTrackTypeLabel } from "@/lib/students/fields";
import type { Student } from "@/lib/types/db";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאת טעינה");
  return j;
};

export function StudentsListClient() {
  const { viewingYear, readOnly } = useAcademicYear();
  const [q, setQ] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [classId, setClassId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [psychology, setPsychology] = useState("");
  const [teachingType, setTeachingType] = useState("");
  const deferred = useDeferredValue(q);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (deferred.trim()) p.set("q", deferred.trim());
    if (gradeLevel) p.set("grade_level", gradeLevel);
    if (classId) p.set("class_id", classId);
    if (specializationId) p.set("specialization_id", specializationId);
    if (trackId) p.set("track_id", trackId);
    if (psychology) p.set("is_psychology", psychology);
    if (teachingType) p.set("teaching_track_type", teachingType);
    const qs = p.toString();
    return withYearQuery(`/api/students${qs ? `?${qs}` : ""}`, viewingYear?.id);
  }, [deferred, gradeLevel, classId, specializationId, trackId, psychology, teachingType, viewingYear?.id]);

  const { data, error, isLoading, mutate } = useSWR<{ students: Student[] }>(url, fetcher);
  const count = data?.students?.length ?? 0;

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [printPreview, setPrintPreview] = useState<{
    studentCount: number;
    estimatedPages: number;
    cards: StudentCardData[];
  } | null>(null);

  const printCardsUrl = useMemo(() => {
    const p = new URLSearchParams();
    if (deferred.trim()) p.set("q", deferred.trim());
    if (gradeLevel) p.set("grade_level", gradeLevel);
    if (classId) p.set("class_id", classId);
    if (specializationId) p.set("specialization_id", specializationId);
    if (trackId) p.set("track_id", trackId);
    if (psychology) p.set("is_psychology", psychology);
    if (teachingType) p.set("teaching_track_type", teachingType);
    const qs = p.toString();
    return withYearQuery(`/api/students/print-cards${qs ? `?${qs}` : ""}`, viewingYear?.id);
  }, [deferred, gradeLevel, classId, specializationId, trackId, psychology, teachingType, viewingYear?.id]);

  async function handleOpenPrintDialog() {
    if (!count) {
      alert("אין תלמידות להדפסה לפי הסינון הנוכחי");
      return;
    }
    setPrintBusy(true);
    try {
      const r = await fetch(printCardsUrl);
      const j = (await r.json()) as {
        error?: string;
        cards?: StudentCardData[];
        studentCount?: number;
        estimatedPages?: number;
      };
      if (!r.ok) throw new Error(j.error ?? "שגיאת טעינה");
      if (!j.cards?.length) {
        alert("אין נתונים להדפסה");
        return;
      }
      setPrintPreview({
        cards: j.cards,
        studentCount: j.studentCount ?? j.cards.length,
        estimatedPages: j.estimatedPages ?? j.cards.length,
      });
      setPrintDialogOpen(true);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setPrintBusy(false);
    }
  }

  function handleConfirmPrint() {
    if (!printPreview?.cards.length) return;
    printStudentCards(printPreview.cards);
    setPrintDialogOpen(false);
    setPrintPreview(null);
  }

  const { data: clData } = useSWR<{ items: { id: string; name: string }[] }>(
    withYearQuery("/api/lookups/classes", viewingYear?.id),
    fetcher,
  );
  const { data: spData } = useSWR<{ items: { id: string; name: string }[] }>(
    withYearQuery("/api/lookups/specializations", viewingYear?.id),
    fetcher,
  );
  const { data: trData } = useSWR<{ items: { id: string; name: string }[] }>(
    withYearQuery("/api/lookups/tracks", viewingYear?.id),
    fetcher,
  );

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="תלמידות"
        subtitle="חיפוש חי: מילה אחת (שם או ת״ז), או שם פרטי ואז רווח ואז שם משפחה — גם בסדר הפוך (משפחה רווח פרטי)"
        actions={
          <>
            <button
              type="button"
              disabled={printBusy || isLoading || !count}
              onClick={() => void handleOpenPrintDialog()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <Printer className="size-4 shrink-0 opacity-80" strokeWidth={2} />
              {printBusy ? "מכין…" : "הדפסת כרטיסים"}
            </button>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="תלמידות"
              sheetName="תלמידות"
              exportUrl={withYearQuery("/api/export/students", viewingYear?.id)}
            />
            {!readOnly ? (
              <>
                <Link href="/students/import" className={LIST_IMPORT_LINK_CLASS}>
                  <Upload className="size-4 shrink-0" strokeWidth={2} />
                  ייבוא מאקסל
                </Link>
                <Link href="/students/new" className={LIST_PRIMARY_LINK_CLASS}>
                  <Plus className="size-4 shrink-0" strokeWidth={2} />
                  הוספת תלמידה
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <ListDataCard>
        <ListFilterBar
          searchValue={q}
          onSearchChange={setQ}
          searchLabel="חיפוש תלמידה"
          searchPlaceholder="למשל: יעל כהן · כהן יעל · ת״ז…"
          searchHint="חיפוש שם פרטי + משפחה גם בסדר הפוך · או ת״ז"
          filters={[
            {
              id: "grade",
              label: "שכבה",
              value: gradeLevel,
              onChange: setGradeLevel,
              options: [
                { value: "א", label: "א" },
                { value: "ב", label: "ב" },
                { value: "ג", label: "ג" },
              ],
            },
            {
              id: "class",
              label: "כיתה",
              value: classId,
              onChange: setClassId,
              options: (clData?.items ?? []).map((it) => ({ value: it.id, label: it.name })),
            },
            {
              id: "track",
              label: "מסלול",
              value: trackId,
              onChange: setTrackId,
              options: (trData?.items ?? []).map((it) => ({ value: it.id, label: it.name })),
            },
            {
              id: "spec",
              label: "התמחות",
              value: specializationId,
              onChange: setSpecializationId,
              options: (spData?.items ?? []).map((it) => ({ value: it.id, label: it.name })),
            },
            {
              id: "psychology",
              label: "פסיכולוגיה",
              value: psychology,
              onChange: setPsychology,
              options: [
                { value: "1", label: "כן" },
                { value: "0", label: "לא" },
              ],
            },
            {
              id: "teaching-type",
              label: "סוג הוראה",
              value: teachingType,
              onChange: setTeachingType,
              options: [
                { value: "full", label: "מלא" },
                { value: "short", label: "מקוצר" },
              ],
            },
          ]}
          isAnyActive={Boolean(
            q || gradeLevel || classId || trackId || specializationId || psychology || teachingType,
          )}
          onClearAll={() => {
            setQ("");
            setGradeLevel("");
            setClassId("");
            setSpecializationId("");
            setTrackId("");
            setPsychology("");
            setTeachingType("");
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
            <span>{data?.students?.length ?? 0} תוצאות</span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>ת״ז</TableHead>
              <TableHead>שכבה</TableHead>
              <TableHead>כיתה</TableHead>
              <TableHead>מסלול</TableHead>
              <TableHead>התמחות</TableHead>
              <TableHead>התמחות נוספת</TableHead>
              <TableHead>פסיכולוגיה</TableHead>
              <TableHead>סוג הוראה</TableHead>
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
                    {(s as { year_label?: string }).year_label ?? `שכבה ${s.grade_level}`}
                  </TableCell>
                  <TableCell>{pickLookupName(s.classes)}</TableCell>
                  <TableCell>{pickLookupName(s.tracks)}</TableCell>
                  <TableCell>{pickLookupName(s.specializations)}</TableCell>
                  <TableCell>{pickLookupName(s.secondary_specializations)}</TableCell>
                  <TableCell>{psychologyLabel(s.is_psychology)}</TableCell>
                  <TableCell>{teachingTrackTypeLabel(s.teaching_track_type)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link
                      href={`/students/${s.id}/edit`}
                      className={LIST_ROW_LINK_CLASS}
                    >
                      <Pencil className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                      עריכה
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={10}>
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
          scopePreviewPath="/api/scope/delete-preview"
          onCleared={() => void mutate()}
        />
      </ListDataCard>

      <StudentCardsPrintConfirmDialog
        open={printDialogOpen}
        onClose={() => {
          if (!printBusy) {
            setPrintDialogOpen(false);
            setPrintPreview(null);
          }
        }}
        onConfirm={handleConfirmPrint}
        busy={printBusy}
        studentCount={printPreview?.studentCount ?? 0}
        estimatedPages={printPreview?.estimatedPages ?? 0}
      />
    </div>
  );
}
