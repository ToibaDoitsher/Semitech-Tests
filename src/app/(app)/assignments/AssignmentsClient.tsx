"use client";

import Link from "next/link";
import { Pencil, Settings2, Trash2, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_ROW_DELETE_CLASS,
} from "@/components/ui/ListPage";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { ListFilterBar, matchesNameQuery } from "@/components/ui/ListFilterBar";
import { Spinner } from "@/components/ui/Spinner";
import type { GradeLevel } from "@/lib/academicYears/types";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import {
  AssignmentTargetForm,
  type AssignmentTargetFormValue,
} from "@/components/assignments/AssignmentTargetForm";
import { TeacherSearchCombobox } from "@/components/teachers/TeacherSearchCombobox";
import { teacherEmbedDisplayName, teachingModeLabel } from "@/lib/teachers/display";
import type { AssignmentCategory, Teacher, TeachingMode } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type GradeOption = { grade_level: string; label: string };

type AssignmentRow = {
  id: string;
  teacher_id: string;
  subject: string;
  lesson_name?: string | null;
  teaching_mode?: TeachingMode | null;
  grade_levels: string[];
  year_label?: string;
  class_ids: string[];
  track_ids: string[];
  specialization_ids: string[];
  psychology_enabled: boolean;
  applies_to_all_in_grade: boolean;
  assignment_category: AssignmentCategory;
  target_label?: string;
  target_type_label?: string;
  teachers: Teacher | null;
};

type LookupItem = { id: string; name: string };

type EditDraft = {
  subject: string;
  lesson_name: string;
} & AssignmentTargetFormValue;

export function AssignmentsClient() {
  const { viewingYear, readOnly } = useAcademicYear();
  const [categoryFilter, setCategoryFilter] = useState<"" | AssignmentCategory>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [teachingModeFilter, setTeachingModeFilter] = useState("");
  const [psychologyFilter, setPsychologyFilter] = useState("");
  const deferredSearch = useDeferredValue(searchTerm);
  const assignmentsUrl = useMemo(() => {
    return withYearQuery("/api/teacher-assignments", viewingYear?.id);
  }, [viewingYear?.id]);
  const { data: aData, error: aErr, isLoading: aLoad, mutate } = useSWR<{
    assignments: AssignmentRow[];
    grades?: GradeOption[];
  }>(assignmentsUrl, fetcher);
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
  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [lessonName, setLessonName] = useState("");
  const emptyTargetForm = (): AssignmentTargetFormValue => ({
    gradeLevels: [],
    classIds: [],
    trackIds: [],
    specializationIds: [],
    psychologyEnabled: false,
    appliesToAllInGrade: false,
    category: "",
    teachingMode: "",
  });
  const [targetForm, setTargetForm] = useState<AssignmentTargetFormValue>(emptyTargetForm);
  const [saving, setSaving] = useState(false);
  const [formNotice, setFormNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!teacherId) return alert("בחרי מורה");
    if (!subject.trim() && !lessonName.trim()) {
      return alert("מלאי מקצוע או שם שיעור (לפחות אחד)");
    }
    if (!targetForm.gradeLevels.length) return alert("בחרי לפחות שכבה אחת");
    if (!targetForm.category) return alert("בחרי סוג שיבוץ: חובה או התמחות");
    if (targetForm.category === "התמחות" && !targetForm.specializationIds.length) {
      return alert("בחרי לפחות התמחות אחת");
    }
    if (
      targetForm.category === "חובה" &&
      !targetForm.appliesToAllInGrade &&
      !targetForm.classIds.length &&
      !targetForm.trackIds.length &&
      !targetForm.psychologyEnabled
    ) {
      return alert("בחרי יעד: כיתות, מסלולים, פסיכולוגיה, או «כל השכבה»");
    }
    setSaving(true);
    setFormNotice(null);
    try {
      const r = await fetch(assignmentsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          subject,
          lesson_name: lessonName.trim() || null,
          grade_levels: targetForm.gradeLevels,
          assignment_category: targetForm.category,
          class_ids: targetForm.classIds,
          track_ids: targetForm.trackIds,
          specialization_ids: targetForm.specializationIds,
          psychology_enabled: targetForm.psychologyEnabled,
          applies_to_all_in_grade: targetForm.appliesToAllInGrade,
          teaching_mode: targetForm.teachingMode || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        created_count?: number;
      };
      if (!r.ok) throw new Error(j.error ?? "שגיאה");
      setTeacherId("");
      setSubject("");
      setLessonName("");
      setTargetForm(emptyTargetForm());
      setFormNotice({ tone: "success", text: "השיבוץ נוסף בהצלחה (שורה אחת)" });
      await mutate();
    } catch (err) {
      setFormNotice({ tone: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(a: AssignmentRow) {
    setEditingId(a.id);
    setEditDraft({
      subject: a.subject,
      lesson_name: a.lesson_name ?? "",
      gradeLevels: a.grade_levels as GradeLevel[],
      classIds: a.class_ids,
      trackIds: a.track_ids,
      specializationIds: a.specialization_ids,
      psychologyEnabled: a.psychology_enabled,
      appliesToAllInGrade: a.applies_to_all_in_grade,
      category: a.assignment_category,
      teachingMode: a.teaching_mode ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft || readOnly) return;
    if (!editDraft.subject.trim() && !editDraft.lesson_name.trim()) {
      return alert("מלאי מקצוע או שם שיעור (לפחות אחד)");
    }
    if (!editDraft.gradeLevels.length) return alert("בחרי לפחות שכבה אחת");
    if (editDraft.category === "התמחות" && !editDraft.specializationIds.length) {
      return alert("בחרי לפחות התמחות אחת");
    }
    if (
      editDraft.category === "חובה" &&
      !editDraft.appliesToAllInGrade &&
      !editDraft.classIds.length &&
      !editDraft.trackIds.length &&
      !editDraft.psychologyEnabled
    ) {
      return alert("בחרי יעד: כיתות, מסלולים, פסיכולוגיה, או «כל השכבה»");
    }
    setEditSaving(true);
    try {
      const r = await fetch(withYearQuery(`/api/teacher-assignments/${id}`, viewingYear?.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editDraft.subject,
          lesson_name: editDraft.lesson_name.trim() || null,
          grade_levels: editDraft.gradeLevels,
          assignment_category: editDraft.category,
          class_ids: editDraft.classIds,
          track_ids: editDraft.trackIds,
          specialization_ids: editDraft.specializationIds,
          psychology_enabled: editDraft.psychologyEnabled,
          applies_to_all_in_grade: editDraft.appliesToAllInGrade,
          teaching_mode: editDraft.teachingMode || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      cancelEdit();
      await mutate();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  async function removeRow(id: string) {
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!confirm("למחוק שיבוץ?")) return;
    const r = await fetch(withYearQuery(`/api/teacher-assignments/${id}`, viewingYear?.id), {
      method: "DELETE",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  const allRows = aData?.assignments ?? [];

  const rows = useMemo(() => {
    return allRows.filter((a) => {
      if (categoryFilter && a.assignment_category !== categoryFilter) return false;
      if (gradeFilter && !a.grade_levels.includes(gradeFilter)) return false;
      if (classFilter && !a.class_ids.includes(classFilter)) return false;
      if (trackFilter && !a.track_ids.includes(trackFilter)) return false;
      if (specFilter && !a.specialization_ids.includes(specFilter)) return false;
      if (teachingModeFilter && (a.teaching_mode ?? "") !== teachingModeFilter) return false;
      if (psychologyFilter === "1" && !a.psychology_enabled) return false;
      if (psychologyFilter === "0" && a.psychology_enabled) return false;
      if (deferredSearch.trim()) {
        const tFirst = a.teachers?.first_name ?? "";
        const tLast = a.teachers?.last_name ?? "";
        const tFull = (a.teachers as { full_name_generated?: string } | null)?.full_name_generated ?? "";
        const matches = matchesNameQuery(deferredSearch, [
          tFirst,
          tLast,
          tFull,
          a.subject,
          a.lesson_name,
          a.target_label,
        ]);
        if (!matches) return false;
      }
      return true;
    });
  }, [
    allRows,
    deferredSearch,
    categoryFilter,
    gradeFilter,
    classFilter,
    trackFilter,
    specFilter,
    teachingModeFilter,
    psychologyFilter,
  ]);

  const isFiltering = Boolean(
    deferredSearch.trim() ||
      categoryFilter ||
      gradeFilter ||
      classFilter ||
      trackFilter ||
      specFilter ||
      teachingModeFilter ||
      psychologyFilter,
  );

  const gradeOptions = (aData?.grades ?? []).map((g) => ({ value: g.grade_level, label: g.label }));

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="שיבוצי מורות"
        subtitle="טבלת כל השיבוצים · ניתן לבחור כמה שכבות (למשל ג + א+ב)"
        actions={
          <>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="שיבוצי-מורות"
              sheetName="שיבוצים"
              exportUrl={withYearQuery("/api/export/assignments", viewingYear?.id)}
            />
            {!readOnly ? (
              <Link
                href="/assignments/import"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200"
              >
                <Upload className="size-4 shrink-0 opacity-80" strokeWidth={2} />
                ייבוא מאקסל
              </Link>
            ) : null}
            <Link href="/settings/classes" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200">
              <Settings2 className="size-4 shrink-0 opacity-80" strokeWidth={2} />
              ניהול לוקאפים
            </Link>
          </>
        }
      />

      {!readOnly ? (
      <>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">הוספת שיבוץ</h2>
        <p className="mt-1 text-base font-light text-slate-500 dark:text-zinc-400">
          מורה → מקצוע → שיעור → שכבות → סוג שיבוץ → יעד
        </p>
      </div>

      <form
        onSubmit={addAssignment}
        className="grid gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-3 dark:border-slate-700/70 dark:bg-zinc-900/50"
      >
        <TeacherSearchCombobox value={teacherId} onChange={(id) => setTeacherId(id)} required />

        <label className="block md:col-span-1">
          <span className="text-sm font-medium text-zinc-700">מקצוע</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="גרפיקה, הנה״ח…"
          />
        </label>

        <label className="block md:col-span-1">
          <span className="text-sm font-medium text-zinc-700">שם שיעור</span>
          <input
            value={lessonName}
            onChange={(e) => setLessonName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="פוטושופ 1, הנה״ח מתקדם…"
          />
          <p className="mt-1 text-xs text-zinc-500">מקצוע או שם שיעור — חובה למלא אחד מהם</p>
        </label>

        <div className="md:col-span-2 lg:col-span-3">
          <AssignmentTargetForm
            value={targetForm}
            onChange={setTargetForm}
            classes={clData?.items ?? []}
            tracks={trData?.items ?? []}
            specializations={spData?.items ?? []}
            disabled={readOnly}
          />
          <p className="mt-2 text-xs text-zinc-600">
            שיבוץ אחד בשורה אחת — כל השכבות והיעדים שנבחרו ייכללו יחד.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:col-span-2 lg:col-span-3">
          {formNotice ? (
            <InlineNotice tone={formNotice.tone}>{formNotice.text}</InlineNotice>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="w-fit rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {saving ? "שומר…" : "הוספת שיבוץ"}
          </button>
        </div>
      </form>
      </>
      ) : null}

      <ListDataCard>
        <ListFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchLabel="חיפוש שיבוץ"
          searchPlaceholder="למשל: שרה כהן · גרפיקה · פוטושופ…"
          searchHint="חיפוש לפי שם מורה (פרטי + משפחה, גם בסדר הפוך) · מקצוע · שיעור · יעד"
          filters={[
            {
              id: "category",
              label: "סוג שיבוץ",
              value: categoryFilter,
              onChange: (v) => setCategoryFilter(v as "" | AssignmentCategory),
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
              options: gradeOptions.length
                ? gradeOptions
                : [
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
            {
              id: "psychology",
              label: "פסיכולוגיה",
              value: psychologyFilter,
              onChange: setPsychologyFilter,
              options: [
                { value: "1", label: "כן" },
                { value: "0", label: "לא" },
              ],
            },
            {
              id: "teaching-mode",
              label: "סוג הוראה",
              value: teachingModeFilter,
              onChange: setTeachingModeFilter,
              options: [
                { value: "full", label: "מלא" },
                { value: "short", label: "מקוצר" },
              ],
            },
          ]}
          isAnyActive={isFiltering}
          onClearAll={() => {
            setSearchTerm("");
            setCategoryFilter("");
            setGradeFilter("");
            setClassFilter("");
            setTrackFilter("");
            setSpecFilter("");
            setTeachingModeFilter("");
            setPsychologyFilter("");
          }}
        />
      </ListDataCard>

      <ListDataCard enterDelay={0.09}>
        <ListTableToolbar>
          {aLoad ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען שיבוצים…
            </span>
          ) : aErr ? (
            <span className="text-red-600">{(aErr as Error).message}</span>
          ) : (
            <span>
              {rows.length} שיבוצים
              {isFiltering && rows.length !== allRows.length ? ` · מתוך ${allRows.length}` : ""}
            </span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>מורה</TableHead>
              <TableHead>מקצוע</TableHead>
              <TableHead>שם שיעור</TableHead>
              <TableHead>סוג שיבוץ</TableHead>
              <TableHead>ערך שיבוץ</TableHead>
              <TableHead>שכבה</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((a) => {
                const isEditing = editingId === a.id && editDraft;
                return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">
                    {teacherEmbedDisplayName(a.teachers)}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <input
                        value={editDraft.subject}
                        onChange={(e) => setEditDraft({ ...editDraft, subject: e.target.value })}
                        className="w-full min-w-[6rem] rounded border border-zinc-200 px-2 py-1 text-sm"
                      />
                    ) : (
                      a.subject
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <input
                        value={editDraft.lesson_name}
                        onChange={(e) => setEditDraft({ ...editDraft, lesson_name: e.target.value })}
                        className="w-full min-w-[6rem] rounded border border-zinc-200 px-2 py-1 text-sm"
                        placeholder="שם שיעור"
                      />
                    ) : (
                      a.lesson_name ?? "—"
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-zinc-300">
                    {isEditing ? editDraft.category : a.assignment_category}
                  </TableCell>
                  <TableCell className="text-slate-800 dark:text-zinc-200" colSpan={isEditing ? 2 : 1}>
                    {isEditing ? (
                      <AssignmentTargetForm
                        value={editDraft}
                        onChange={(next) => setEditDraft({ ...editDraft, ...next })}
                        classes={clData?.items ?? []}
                        tracks={trData?.items ?? []}
                        specializations={spData?.items ?? []}
                      />
                    ) : (
                      a.target_label ?? "—"
                    )}
                  </TableCell>
                  {isEditing ? null : (
                  <TableCell>
                      <>
                        {a.year_label ?? a.grade_levels.join(", ")}
                        {a.teaching_mode ? ` · ${teachingModeLabel(a.teaching_mode)}` : ""}
                      </>
                  </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    {!readOnly ? (
                      isEditing ? (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            disabled={editSaving}
                            className="text-sm font-medium text-emerald-800"
                            onClick={() => void saveEdit(a.id)}
                          >
                            {editSaving ? "שומר…" : "שמירה"}
                          </button>
                          <button type="button" className="text-sm text-zinc-500" onClick={cancelEdit}>
                            ביטול
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                            onClick={() => startEdit(a)}
                          >
                            <Pencil className="size-3.5" strokeWidth={2} />
                            עריכה
                          </button>
                          <button type="button" className={LIST_ROW_DELETE_CLASS} onClick={() => void removeRow(a.id)}>
                            <Trash2 className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
                            מחיקה
                          </button>
                        </span>
                      )
                    ) : null}
                  </TableCell>
                </TableRow>
              );
              })
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={7}>
                  {aLoad ? "טוען…" : isFiltering ? "אין תוצאות תואמות לסינון" : "אין שיבוצים"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="שיבוצי מורות"
          count={allRows.length}
          apiPath="/api/teacher-assignments/clear-all"
          scopePreviewPath="/api/scope/delete-preview"
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}

