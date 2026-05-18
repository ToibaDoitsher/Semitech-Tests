"use client";

import Link from "next/link";
import { Pencil, Settings2, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_ROW_DELETE_CLASS,
} from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { TeacherSearchCombobox } from "@/components/teachers/TeacherSearchCombobox";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import { teacherEmbedDisplayName, teachingModeLabel } from "@/lib/teachers/display";
import type { AssignmentCategory, Teacher, TeachingMode } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type LayerOption = { grade_level: string; year_group: number; label: string };

type AssignmentRow = {
  id: string;
  teacher_id: string;
  subject: string;
  lesson_name?: string | null;
  teaching_mode?: TeachingMode | null;
  year_group: number;
  grade_level: string;
  year_label?: string;
  class_id: string | null;
  specialization_id: string | null;
  track_id: string | null;
  psychology_enabled: boolean;
  assignment_category: AssignmentCategory;
  target_label?: string;
  target_type_label?: string;
  teachers: Teacher | null;
};

type LookupItem = { id: string; name: string };

type TargetDraft = {
  assignment_category: AssignmentCategory;
  class_id: string;
  specialization_id: string;
  track_id: string;
  psychology_enabled: boolean;
};

export function AssignmentsClient() {
  const { viewingYear, readOnly } = useAcademicYear();
  const [categoryFilter, setCategoryFilter] = useState<"" | AssignmentCategory>("");
  const assignmentsUrl = useMemo(() => {
    const base = withYearQuery("/api/teacher-assignments", viewingYear?.id);
    if (!categoryFilter) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}assignment_category=${encodeURIComponent(categoryFilter)}`;
  }, [viewingYear?.id, categoryFilter]);
  const { data: aData, error: aErr, isLoading: aLoad, mutate } = useSWR<{
    assignments: AssignmentRow[];
    layers?: LayerOption[];
  }>(assignmentsUrl, fetcher);
  const { data: clData } = useSWR<{ items: LookupItem[] }>("/api/lookups/classes", fetcher);
  const { data: spData } = useSWR<{ items: LookupItem[] }>("/api/lookups/specializations", fetcher);
  const { data: trData } = useSWR<{ items: LookupItem[] }>("/api/lookups/tracks", fetcher);

  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [lessonName, setLessonName] = useState("");
  const [yearGroup, setYearGroup] = useState<number | "">("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [classId, setClassId] = useState("");
  const [specializationId, setSpecializationId] = useState("");
  const [trackId, setTrackId] = useState("");
  const [psychologyEnabled, setPsychologyEnabled] = useState(false);
  const [assignmentCategory, setAssignmentCategory] = useState<"" | AssignmentCategory>("");
  const [teachingMode, setTeachingMode] = useState<TeachingMode | "">("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    subject: string;
    lesson_name: string;
    year_group: number;
    grade_level: string;
    teaching_mode: TeachingMode | "";
  } & TargetDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const selectedTrackName = trData?.items.find((t) => t.id === trackId)?.name ?? "";
  const showTeachingMode =
    assignmentCategory === "חובה" && Boolean(trackId) && selectedTrackName === TEACHING_TRACK_NAME;
  const showMandatoryTargets = assignmentCategory === "חובה";
  const showSpecializationTarget = assignmentCategory === "התמחות";

  function selectCategory(next: AssignmentCategory) {
    setAssignmentCategory(next);
    if (next === "חובה") setSpecializationId("");
    if (next === "התמחות") {
      setClassId("");
      setTrackId("");
      setPsychologyEnabled(false);
      setTeachingMode("");
    }
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!teacherId) return alert("בחרי מורה");
    if (!yearGroup || !gradeLevel) return alert("בחרי שנתון ושכבה");
    if (!assignmentCategory) return alert("בחרי סוג שיבוץ: חובה או התמחות");
    if (assignmentCategory === "התמחות") {
      if (!specializationId) return alert("בחרי התמחות");
    } else if (!classId && !trackId && !psychologyEnabled) {
      return alert("בחרי יעד אחד: כיתה, מסלול או פסיכולוגיה");
    }
    setSaving(true);
    try {
      const r = await fetch(assignmentsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          subject,
          lesson_name: lessonName.trim() || null,
          year_group: yearGroup,
          grade_level: gradeLevel,
          assignment_category: assignmentCategory,
          class_id: assignmentCategory === "חובה" ? classId || null : null,
          specialization_id: assignmentCategory === "התמחות" ? specializationId || null : null,
          track_id: assignmentCategory === "חובה" ? trackId || null : null,
          psychology_enabled: assignmentCategory === "חובה" ? psychologyEnabled : false,
          teaching_mode: showTeachingMode ? teachingMode || null : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setTeacherId("");
      setSubject("");
      setLessonName("");
      setYearGroup("");
      setGradeLevel("");
      setClassId("");
      setSpecializationId("");
      setTrackId("");
      setPsychologyEnabled(false);
      setAssignmentCategory("");
      setTeachingMode("");
      await mutate();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(a: AssignmentRow) {
    setEditingId(a.id);
    setEditDraft({
      subject: a.subject,
      lesson_name: a.lesson_name ?? "",
      year_group: a.year_group,
      grade_level: a.grade_level,
      assignment_category: a.assignment_category,
      class_id: a.class_id ?? "",
      specialization_id: a.specialization_id ?? "",
      track_id: a.track_id ?? "",
      psychology_enabled: a.psychology_enabled,
      teaching_mode: a.teaching_mode ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  const editTrackName =
    editDraft?.track_id ? (trData?.items.find((t) => t.id === editDraft.track_id)?.name ?? "") : "";
  const editShowTeachingMode =
    editDraft?.assignment_category === "חובה" &&
    Boolean(editDraft?.track_id) &&
    editTrackName === TEACHING_TRACK_NAME;

  async function saveEdit(id: string) {
    if (!editDraft || readOnly) return;
    setEditSaving(true);
    try {
      const r = await fetch(withYearQuery(`/api/teacher-assignments/${id}`, viewingYear?.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editDraft.subject,
          lesson_name: editDraft.lesson_name.trim() || null,
          year_group: editDraft.year_group,
          grade_level: editDraft.grade_level,
          assignment_category: editDraft.assignment_category,
          class_id: editDraft.assignment_category === "חובה" ? editDraft.class_id || null : null,
          specialization_id:
            editDraft.assignment_category === "התמחות" ? editDraft.specialization_id || null : null,
          track_id: editDraft.assignment_category === "חובה" ? editDraft.track_id || null : null,
          psychology_enabled:
            editDraft.assignment_category === "חובה" ? editDraft.psychology_enabled : false,
          teaching_mode: editShowTeachingMode ? editDraft.teaching_mode || null : null,
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

  const rows = aData?.assignments ?? [];

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="שיבוצי מורות"
        subtitle="טבלת כל השיבוצים · יעד אחד בלבד לכל שיבוץ"
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
          מורה → מקצוע → שיעור → שכבה → סוג שיבוץ → יעד
        </p>
      </div>

      <form
        onSubmit={addAssignment}
        className="grid gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-3 dark:border-slate-700/70 dark:bg-zinc-900/50"
      >
        <TeacherSearchCombobox value={teacherId} onChange={(id) => setTeacherId(id)} required />

        <label className="block md:col-span-1">
          <span className="text-sm font-medium text-zinc-700">מקצוע *</span>
          <input
            required
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
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">שנתון / שכבה *</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={gradeLevel && yearGroup ? `${yearGroup}:${gradeLevel}` : ""}
            onChange={(e) => {
              const [yg, gl] = e.target.value.split(":");
              setYearGroup(yg ? Number.parseInt(yg, 10) : "");
              setGradeLevel(gl ?? "");
            }}
          >
            <option value="">— בחרי —</option>
            {(aData?.layers ?? []).map((l) => (
              <option key={l.grade_level} value={`${l.year_group}:${l.grade_level}`}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="block md:col-span-2 lg:col-span-3">
          <legend className="text-sm font-medium text-zinc-700">סוג שיבוץ *</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {(["חובה", "התמחות"] as const).map((opt) => (
              <label key={opt} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="assignment_category"
                  required
                  checked={assignmentCategory === opt}
                  onChange={() => selectCategory(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>

        {showMandatoryTargets ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">כיתה</span>
              <select
                value={classId}
                onChange={(e) => {
                  const v = e.target.value;
                  setClassId(v);
                  if (v) {
                    setTrackId("");
                    setPsychologyEnabled(false);
                    setTeachingMode("");
                  }
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— ללא —</option>
                {(clData?.items ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">מסלול</span>
              <select
                value={trackId}
                onChange={(e) => {
                  const v = e.target.value;
                  setTrackId(v);
                  if (v) {
                    setClassId("");
                    setPsychologyEnabled(false);
                  } else {
                    setTeachingMode("");
                  }
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">— ללא —</option>
                {(trData?.items ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 md:col-span-2">
              <input
                type="checkbox"
                checked={psychologyEnabled}
                onChange={(e) => {
                  const on = e.target.checked;
                  setPsychologyEnabled(on);
                  if (on) {
                    setClassId("");
                    setTrackId("");
                    setTeachingMode("");
                  }
                }}
              />
              <span className="text-sm font-medium text-zinc-700">מיועד לפסיכולוגיה</span>
            </label>
          </>
        ) : null}

        {showSpecializationTarget ? (
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">התמחות *</span>
            <select
              required
              value={specializationId}
              onChange={(e) => setSpecializationId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">— בחרי —</option>
              {(spData?.items ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showTeachingMode ? (
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">סוג הוראה</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={teachingMode}
              onChange={(e) => setTeachingMode(e.target.value as TeachingMode | "")}
            >
              <option value="">— ללא סינון —</option>
              <option value="full">מלא</option>
              <option value="short">מקוצר</option>
            </select>
          </label>
        ) : null}

        <div className="flex items-end md:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {saving ? "שומר…" : "הוספת שיבוץ"}
          </button>
        </div>
      </form>
      </>
      ) : null}

      <ListDataCard>
        <ListTableToolbar>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
            <span className="font-medium">סוג שיבוץ</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as "" | AssignmentCategory)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            >
              <option value="">הכל</option>
              <option value="חובה">חובה</option>
              <option value="התמחות">התמחות</option>
            </select>
          </label>
          {aLoad ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען שיבוצים…
            </span>
          ) : aErr ? (
            <span className="text-red-600">{(aErr as Error).message}</span>
          ) : (
            <span>{rows.length} שיבוצים</span>
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
              <TableHead>שנתון</TableHead>
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
                    {isEditing ? (
                      <div className="flex flex-col gap-1 text-xs">
                        {(["חובה", "התמחות"] as const).map((opt) => (
                          <label key={opt} className="inline-flex items-center gap-1">
                            <input
                              type="radio"
                              checked={editDraft.assignment_category === opt}
                              onChange={() => {
                                const next = { ...editDraft, assignment_category: opt };
                                if (opt === "חובה") next.specialization_id = "";
                                if (opt === "התמחות") {
                                  next.class_id = "";
                                  next.track_id = "";
                                  next.psychology_enabled = false;
                                  next.teaching_mode = "";
                                }
                                setEditDraft(next);
                              }}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : (
                      a.assignment_category
                    )}
                  </TableCell>
                  <TableCell className="text-slate-800 dark:text-zinc-200">
                    {isEditing ? (
                      <div className="flex min-w-[14rem] flex-col gap-1">
                        {editDraft.assignment_category === "חובה" ? (
                          <>
                            <select
                              value={editDraft.class_id}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditDraft({
                                  ...editDraft,
                                  class_id: v,
                                  track_id: v ? "" : editDraft.track_id,
                                  psychology_enabled: v ? false : editDraft.psychology_enabled,
                                  teaching_mode: v ? "" : editDraft.teaching_mode,
                                });
                              }}
                              className="rounded border border-zinc-200 px-1 py-0.5 text-xs"
                            >
                              <option value="">כיתה</option>
                              {(clData?.items ?? []).map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editDraft.track_id}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditDraft({
                                  ...editDraft,
                                  track_id: v,
                                  class_id: v ? "" : editDraft.class_id,
                                  psychology_enabled: v ? false : editDraft.psychology_enabled,
                                  teaching_mode: v ? "" : editDraft.teaching_mode,
                                });
                              }}
                              className="rounded border border-zinc-200 px-1 py-0.5 text-xs"
                            >
                              <option value="">מסלול</option>
                              {(trData?.items ?? []).map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                            <label className="inline-flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={editDraft.psychology_enabled}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setEditDraft({
                                    ...editDraft,
                                    psychology_enabled: on,
                                    class_id: on ? "" : editDraft.class_id,
                                    track_id: on ? "" : editDraft.track_id,
                                    teaching_mode: on ? "" : editDraft.teaching_mode,
                                  });
                                }}
                              />
                              פסיכולוגיה
                            </label>
                          </>
                        ) : (
                          <select
                            value={editDraft.specialization_id}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, specialization_id: e.target.value })
                            }
                            className="rounded border border-zinc-200 px-1 py-0.5 text-xs"
                          >
                            <option value="">התמחות</option>
                            {(spData?.items ?? []).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      a.target_label ?? "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <select
                          value={`${editDraft.year_group}:${editDraft.grade_level}`}
                          onChange={(e) => {
                            const [yg, gl] = e.target.value.split(":");
                            setEditDraft({
                              ...editDraft,
                              year_group: yg ? Number.parseInt(yg, 10) : editDraft.year_group,
                              grade_level: gl ?? editDraft.grade_level,
                            });
                          }}
                          className="rounded border border-zinc-200 px-2 py-1 text-sm"
                        >
                          {(aData?.layers ?? []).map((l) => (
                            <option
                              key={`${l.year_group}:${l.grade_level}`}
                              value={`${l.year_group}:${l.grade_level}`}
                            >
                              {l.label}
                            </option>
                          ))}
                        </select>
                        {editShowTeachingMode ? (
                          <select
                            value={editDraft.teaching_mode}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                teaching_mode: e.target.value as TeachingMode | "",
                              })
                            }
                            className="rounded border border-zinc-200 px-2 py-1 text-sm"
                          >
                            <option value="">—</option>
                            <option value="full">מלא</option>
                            <option value="short">מקוצר</option>
                          </select>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        {a.year_label ?? `שנתון ${a.year_group} — שכבה ${a.grade_level}`}
                        {a.teaching_mode ? ` · ${teachingModeLabel(a.teaching_mode)}` : ""}
                      </>
                    )}
                  </TableCell>
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
                  {aLoad ? "טוען…" : "אין שיבוצים"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="שיבוצי מורות"
          count={rows.length}
          apiPath="/api/teacher-assignments/clear-all"
          scopePreviewPath="/api/scope/delete-preview"
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}

