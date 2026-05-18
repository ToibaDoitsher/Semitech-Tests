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
import type { ExamTargetType, Teacher, TeachingMode } from "@/lib/types/db";

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
  target_type: ExamTargetType;
  target_id: string;
  target_label?: string;
  target_type_label?: string;
  teachers: Teacher | null;
};

type LookupItem = { id: string; name: string };

const targetStepOptions: { value: ExamTargetType; label: string }[] = [
  { value: "class", label: "כיתה" },
  { value: "specialization", label: "התמחות" },
  { value: "track", label: "מסלול" },
  { value: "psychology", label: "פסיכולוגיה" },
];

export function AssignmentsClient() {
  const { viewingYear, readOnly } = useAcademicYear();
  const assignmentsUrl = withYearQuery("/api/teacher-assignments", viewingYear?.id);
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
  const [targetKind, setTargetKind] = useState<ExamTargetType>("class");
  const [targetId, setTargetId] = useState("");
  const [teachingMode, setTeachingMode] = useState<TeachingMode | "">("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    subject: string;
    lesson_name: string;
    year_group: number;
    grade_level: string;
    target_type: ExamTargetType;
    target_id: string;
    teaching_mode: TeachingMode | "";
  } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const targetItems = useMemo(() => {
    if (targetKind === "class") return clData?.items ?? [];
    if (targetKind === "specialization") return spData?.items ?? [];
    return trData?.items ?? [];
  }, [targetKind, clData, spData, trData]);

  const selectedTrackName =
    targetKind === "track" ? (trData?.items.find((t) => t.id === targetId)?.name ?? "") : "";
  const showTeachingMode = targetKind === "track" && selectedTrackName === TEACHING_TRACK_NAME;

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!teacherId) return alert("בחרי מורה");
    if (!yearGroup || !gradeLevel) return alert("בחרי שנתון ושכבה");
    if (targetKind !== "psychology" && !targetId) return alert("בחרי יעד לשיבוץ");
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
          target_type: targetKind,
          target_id: targetId,
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
      setTargetId("");
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
      target_type: a.target_type,
      target_id: a.target_type === "psychology" ? "" : a.target_id,
      teaching_mode: a.teaching_mode ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  const editTrackName =
    editDraft?.target_type === "track"
      ? (trData?.items.find((t) => t.id === editDraft.target_id)?.name ?? "")
      : "";
  const editShowTeachingMode =
    editDraft?.target_type === "track" && editTrackName === TEACHING_TRACK_NAME;

  const editTargetItems = useMemo(() => {
    if (!editDraft) return [];
    if (editDraft.target_type === "class") return clData?.items ?? [];
    if (editDraft.target_type === "specialization") return spData?.items ?? [];
    return trData?.items ?? [];
  }, [editDraft, clData, spData, trData]);

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
          target_type: editDraft.target_type,
          target_id: editDraft.target_type === "psychology" ? undefined : editDraft.target_id,
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
        <p className="mt-1 text-base font-light text-slate-500 dark:text-zinc-400">שלב 1: סוג יעד · שלב 2: בחירת ערך מהרשימה</p>
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

        <fieldset className="md:col-span-2 lg:col-span-3">
          <legend className="text-sm font-medium text-zinc-700">שלב 1 — סוג שיבוץ (אחד בלבד)</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {targetStepOptions.map((o) => (
              <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="targetKind"
                  value={o.value}
                  checked={targetKind === o.value}
                  onChange={() => {
                    setTargetKind(o.value);
                    setTargetId("");
                    setTeachingMode("");
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        {targetKind === "psychology" ? (
          <p className="text-sm text-zinc-600 md:col-span-2 lg:col-span-3">
            שיבוץ פסיכולוגיה — כל תלמידות עם סימון פסיכולוגיה בשנתון/שכבה שנבחרו
          </p>
        ) : (
          <label className="block md:col-span-2 lg:col-span-3">
            <span className="text-sm font-medium text-zinc-700">שלב 2 — ערך יעד *</span>
            <select
              required
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setTeachingMode("");
              }}
              className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">— בחרי —</option>
              {targetItems.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}

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
                      <select
                        value={editDraft.target_type}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            target_type: e.target.value as ExamTargetType,
                            target_id: "",
                            teaching_mode: "",
                          })
                        }
                        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm"
                      >
                        {targetStepOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      a.target_type_label ?? a.target_type
                    )}
                  </TableCell>
                  <TableCell className="text-slate-800 dark:text-zinc-200">
                    {isEditing ? (
                      editDraft.target_type === "psychology" ? (
                        <span className="text-sm text-zinc-500">כל הפסיכולוגיה</span>
                      ) : (
                        <select
                          value={editDraft.target_id}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, target_id: e.target.value, teaching_mode: "" })
                          }
                          className="w-full min-w-[8rem] rounded border border-zinc-200 px-2 py-1 text-sm"
                        >
                          <option value="">— בחרי —</option>
                          {editTargetItems.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      a.target_label ?? a.target_id
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

