"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import type { GradeLevel } from "@/lib/academicYears/types";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { Spinner } from "@/components/ui/Spinner";
import { todayHebrewParts, hebrewPartsToGregorianYmd } from "@/lib/hebrewDate";
import { TeacherSearchCombobox } from "@/components/teachers/TeacherSearchCombobox";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import { teachingModeLabel } from "@/lib/teachers/display";
import type { AssignmentCategory, TeachingMode, TeachingTrackType } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type AssignmentRow = {
  id: string;
  subject: string;
  lesson_name?: string | null;
  teaching_mode?: TeachingMode | null;
  grade_level: string;
  year_label?: string;
  track_id: string | null;
  target_label?: string;
  target_type_label?: string;
};

type GradeLevelOption = {
  id: string;
  name: string;
  grade_levels: GradeLevel[];
};

type LookupItem = { id: string; name: string };

export function NewExamClient() {
  const router = useRouter();
  const { viewingYear, readOnly } = useAcademicYear();

  const [teacherId, setTeacherId] = useState("");
  const [gradeLevelOptionIds, setGradeLevelOptionIds] = useState<string[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<"existing" | "new">("existing");

  const assignUrl = useMemo(() => {
    if (!teacherId) return null;
    const p = new URLSearchParams({ teacher_id: teacherId });
    return withYearQuery(`/api/teacher-assignments?${p.toString()}`, viewingYear?.id);
  }, [teacherId, viewingYear?.id]);

  const { data: aData, isLoading: aLoad } = useSWR<{ assignments: AssignmentRow[] }>(assignUrl, fetcher);
  const { data: gradeData } = useSWR<{ items: GradeLevelOption[] }>(
    "/api/lookups/grade-level-options",
    fetcher,
  );
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

  const gradeOptions = gradeData?.items ?? [];
  const allAssignments = aData?.assignments ?? [];

  const selectedGradeLevels = useMemo(() => {
    const levels = new Set<GradeLevel>();
    for (const id of gradeLevelOptionIds) {
      const opt = gradeOptions.find((o) => o.id === id);
      opt?.grade_levels.forEach((g) => levels.add(g));
    }
    return levels;
  }, [gradeLevelOptionIds, gradeOptions]);

  const activeAssignments = useMemo(() => {
    if (!selectedGradeLevels.size) return allAssignments;
    return allAssignments.filter((a) => selectedGradeLevels.has(a.grade_level as GradeLevel));
  }, [allAssignments, selectedGradeLevels]);

  const [assignmentId, setAssignmentId] = useState("");
  const [examDate, setExamDate] = useState(() => {
    const p = todayHebrewParts();
    return hebrewPartsToGregorianYmd(p) ?? "";
  });
  const [teachingTrackType, setTeachingTrackType] = useState<TeachingTrackType | "">("");

  const [newSubject, setNewSubject] = useState("");
  const [newLessonName, setNewLessonName] = useState("");
  const [newCategory, setNewCategory] = useState<"" | AssignmentCategory>("");
  const [newClassId, setNewClassId] = useState("");
  const [newSpecializationId, setNewSpecializationId] = useState("");
  const [newTrackId, setNewTrackId] = useState("");
  const [newPsychologyEnabled, setNewPsychologyEnabled] = useState(false);
  const [newTeachingMode, setNewTeachingMode] = useState<TeachingMode | "">("");

  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => activeAssignments.find((a) => a.id === assignmentId),
    [activeAssignments, assignmentId],
  );

  const newTrackName = newTrackId ? (trData?.items.find((t) => t.id === newTrackId)?.name ?? "") : "";
  const newShowTeachingMode =
    newCategory === "חובה" && Boolean(newTrackId) && newTrackName === TEACHING_TRACK_NAME;
  const newIsTeachingTarget = newShowTeachingMode;

  const isTeachingTarget =
    assignmentMode === "existing"
      ? Boolean(selected?.track_id) &&
        (selected?.target_label === TEACHING_TRACK_NAME ||
          selected?.target_label?.includes(TEACHING_TRACK_NAME))
      : newIsTeachingTarget;

  useEffect(() => {
    setAssignmentId("");
    setAssignmentMode("existing");
  }, [teacherId]);

  useEffect(() => {
    if (
      teacherId &&
      gradeLevelOptionIds.length > 0 &&
      !aLoad &&
      allAssignments.length === 0
    ) {
      setAssignmentMode("new");
    }
  }, [teacherId, gradeLevelOptionIds.length, aLoad, allAssignments.length]);

  useEffect(() => {
    setAssignmentId("");
  }, [gradeLevelOptionIds]);

  useEffect(() => {
    if (assignmentMode === "existing" && selected?.teaching_mode) {
      setTeachingTrackType(selected.teaching_mode);
    } else if (assignmentMode === "existing" && !isTeachingTarget) {
      setTeachingTrackType("");
    }
  }, [assignmentMode, selected?.id, selected?.teaching_mode, isTeachingTarget]);

  function selectNewCategory(next: AssignmentCategory) {
    setNewCategory(next);
    if (next === "חובה") setNewSpecializationId("");
    if (next === "התמחות") {
      setNewClassId("");
      setNewTrackId("");
      setNewPsychologyEnabled(false);
      setNewTeachingMode("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!teacherId || !gradeLevelOptionIds.length || !examDate) {
      alert("מלאי מורה, שכבה (אחת או יותר) ותאריך");
      return;
    }

    if (assignmentMode === "existing") {
      if (!selected) {
        alert("בחרי שיבוץ קיים");
        return;
      }
      if (isTeachingTarget && !teachingTrackType) {
        alert("במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)");
        return;
      }
    } else {
      if (!newSubject.trim() && !newLessonName.trim()) {
        alert("מלאי מקצוע או שם שיעור (לפחות אחד)");
        return;
      }
      if (!newCategory) {
        alert("בחרי סוג שיבוץ: חובה או התמחות");
        return;
      }
      if (newCategory === "התמחות") {
        if (!newSpecializationId) return alert("בחרי התמחות");
      } else if (!newClassId && !newTrackId && !newPsychologyEnabled) {
        return alert("בחרי יעד אחד: כיתה, מסלול או פסיכולוגיה");
      }
      if (newIsTeachingTarget && !teachingTrackType) {
        alert("במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)");
        return;
      }
    }

    setSaving(true);
    try {
      const body =
        assignmentMode === "existing"
          ? {
              teacher_id: teacherId,
              subject: selected!.subject,
              exam_date: examDate,
              grade_level_option_ids: gradeLevelOptionIds,
              teacher_assignment_id: selected!.id,
              teaching_track_type: isTeachingTarget ? teachingTrackType : null,
            }
          : {
              teacher_id: teacherId,
              exam_date: examDate,
              grade_level_option_ids: gradeLevelOptionIds,
              teaching_track_type: newIsTeachingTarget ? teachingTrackType : null,
              new_assignment: {
                subject: newSubject,
                lesson_name: newLessonName.trim() || null,
                assignment_category: newCategory,
                class_id: newCategory === "חובה" ? newClassId || null : null,
                specialization_id: newCategory === "התמחות" ? newSpecializationId || null : null,
                track_id: newCategory === "חובה" ? newTrackId || null : null,
                psychology_enabled: newCategory === "חובה" ? newPsychologyEnabled : false,
                teaching_mode: newShowTeachingMode ? newTeachingMode || null : null,
              },
            };

      const r = await fetch(withYearQuery("/api/exams", viewingYear?.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");

      const examId = (j as { exam?: { id: string } }).exam?.id;
      const createdCount = (j as { created_count?: number }).created_count ?? 1;
      const assignmentsCreated = (j as { assignments_created?: number }).assignments_created ?? 0;

      let msg = createdCount > 1 ? `נוצרו ${createdCount} מבחנים` : "המבחן נוצר";
      if (assignmentsCreated > 0) {
        msg += ` (נוצרו ${assignmentsCreated} שיבוצים חדשים)`;
      }
      if (createdCount > 1 || assignmentsCreated > 0) {
        alert(msg);
        router.push("/exams");
        return;
      }
      if (examId) router.push(`/exams/${examId}`);
      else router.push("/exams");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const showExistingPicker = assignmentMode === "existing";
  const showNewForm = assignmentMode === "new";
  const canPickExisting = allAssignments.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">יצירת מבחן</h1>
          <p className="mt-1 text-sm text-zinc-600">
            מורה → שכבה → שיבוץ → תאריך. אם חסר שיבוץ לשכבה — ייווצר אוטומטית. אפשר גם ליצור שיבוץ חדש לגמרי.
            {viewingYear ? ` (${viewingYear.year_name})` : ""}
          </p>
        </div>
        <Link
          href="/exams"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          חזרה
        </Link>
      </div>

      <form onSubmit={submit} className="grid max-w-xl gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <TeacherSearchCombobox
          value={teacherId}
          onChange={(id) => {
            setTeacherId(id);
            setGradeLevelOptionIds([]);
          }}
          disabled={readOnly}
          required
          label="מורה"
        />

        <fieldset className="block" disabled={!teacherId || readOnly}>
          <legend className="text-sm font-medium text-zinc-700">שכבות * (אפשר כמה)</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {gradeOptions.map((o) => {
              const checked = gradeLevelOptionIds.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setGradeLevelOptionIds((prev) =>
                        checked ? prev.filter((id) => id !== o.id) : [...prev, o.id],
                      );
                    }}
                  />
                  {o.name}
                  <span className="text-xs text-zinc-500">({o.grade_levels.join(", ")})</span>
                </label>
              );
            })}
          </div>
          {gradeLevelOptionIds.length > 1 ? (
            <p className="mt-2 text-xs text-zinc-600">
              נבחרו {selectedGradeLevels.size} שכבות — ייווצרו עד {selectedGradeLevels.size} מבחנים
            </p>
          ) : null}
        </fieldset>

        {teacherId && gradeLevelOptionIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {canPickExisting ? (
              <button
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  assignmentMode === "existing"
                    ? "border-zinc-900 bg-zinc-50 font-medium"
                    : "border-zinc-200"
                }`}
                onClick={() => setAssignmentMode("existing")}
              >
                שיבוץ קיים
              </button>
            ) : null}
            <button
              type="button"
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                assignmentMode === "new"
                  ? "border-zinc-900 bg-zinc-50 font-medium"
                  : "border-zinc-200"
              }`}
              onClick={() => setAssignmentMode("new")}
            >
              {canPickExisting ? "שיבוץ חדש" : "יצירת שיבוץ ומבחן"}
            </button>
          </div>
        ) : null}

        {showExistingPicker ? (
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">שיבוץ (מקצוע · יעד)</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={assignmentId}
              onChange={(e) => {
                setAssignmentId(e.target.value);
                setTeachingTrackType("");
              }}
              required
              disabled={!teacherId || !gradeLevelOptionIds.length || readOnly}
            >
              <option value="">— בחרי —</option>
              {activeAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.year_label ? `${a.year_label} · ` : ""}
                  {a.subject}
                  {a.lesson_name ? ` · ${a.lesson_name}` : ""}
                  {a.teaching_mode ? ` · ${teachingModeLabel(a.teaching_mode)}` : ""}
                  {" · "}
                  {a.target_type_label ? `${a.target_type_label}: ` : ""}
                  {a.target_label ?? "—"}
                </option>
              ))}
            </select>
            {aLoad ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                <Spinner className="size-4" />
                טוען שיבוצים…
              </div>
            ) : !activeAssignments.length && selectedGradeLevels.size ? (
              <p className="mt-1 text-xs text-amber-800">
                אין שיבוצים לשכבות שנבחרו — עברי ל«שיבוץ חדש» או בחרי שכבה אחרת
              </p>
            ) : selectedGradeLevels.size > 1 && selected ? (
              <p className="mt-1 text-xs text-zinc-600">
                לשכבות חסרות ייווצר שיבוץ אוטומטי לפי הבחירה (אותו מקצוע ויעד)
              </p>
            ) : null}
          </label>
        ) : null}

        {showNewForm ? (
          <fieldset className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
            <legend className="px-1 text-sm font-medium text-zinc-800">יצירת שיבוץ ומבחן</legend>

            <label className="block">
              <span className="text-sm font-medium text-zinc-700">מקצוע</span>
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="גרפיקה, הנה״ח…"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-700">שם שיעור</span>
              <input
                value={newLessonName}
                onChange={(e) => setNewLessonName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="אופציונלי"
              />
              <p className="mt-1 text-xs text-zinc-500">מקצוע או שם שיעור — חובה למלא אחד מהם</p>
            </label>

            <div>
              <span className="text-sm font-medium text-zinc-700">סוג שיבוץ *</span>
              <div className="mt-2 flex flex-wrap gap-4">
                {(["חובה", "התמחות"] as const).map((opt) => (
                  <label key={opt} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="new_assignment_category"
                      checked={newCategory === opt}
                      onChange={() => selectNewCategory(opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            {newCategory === "חובה" ? (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-zinc-700">כיתה</span>
                  <select
                    value={newClassId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewClassId(v);
                      if (v) {
                        setNewTrackId("");
                        setNewPsychologyEnabled(false);
                        setNewTeachingMode("");
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
                    value={newTrackId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setNewTrackId(v);
                      if (v) {
                        setNewClassId("");
                        setNewPsychologyEnabled(false);
                      } else {
                        setNewTeachingMode("");
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
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newPsychologyEnabled}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setNewPsychologyEnabled(on);
                      if (on) {
                        setNewClassId("");
                        setNewTrackId("");
                        setNewTeachingMode("");
                      }
                    }}
                  />
                  מיועד לפסיכולוגיה
                </label>
              </>
            ) : null}

            {newCategory === "התמחות" ? (
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">התמחות *</span>
                <select
                  required
                  value={newSpecializationId}
                  onChange={(e) => setNewSpecializationId(e.target.value)}
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

            {newShowTeachingMode ? (
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">סוג הוראה (בשיבוץ)</span>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                  value={newTeachingMode}
                  onChange={(e) => setNewTeachingMode(e.target.value as TeachingMode | "")}
                >
                  <option value="">— ללא סינון —</option>
                  <option value="full">מלא</option>
                  <option value="short">מקוצר</option>
                </select>
              </label>
            ) : null}
          </fieldset>
        ) : null}

        {isTeachingTarget ? (
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">סוג הוראה במבחן *</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={teachingTrackType}
              onChange={(e) => setTeachingTrackType(e.target.value as TeachingTrackType | "")}
              required
            >
              <option value="">— בחרי —</option>
              <option value="full">מלא</option>
              <option value="short">מקוצר</option>
            </select>
          </label>
        ) : null}

        <HebrewDatePicker
          label="תאריך מבחן (עברי)"
          value={examDate}
          onChange={setExamDate}
          required
          disabled={readOnly}
        />

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || readOnly}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving
              ? "יוצר…"
              : assignmentMode === "new"
                ? "יצירת שיבוץ ומבחן"
                : "יצירת מבחן ושיוך תלמידות"}
          </button>
        </div>
      </form>
    </div>
  );
}
