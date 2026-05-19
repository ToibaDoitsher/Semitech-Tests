"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import {
  AssignmentTargetForm,
  type AssignmentTargetFormValue,
} from "@/components/assignments/AssignmentTargetForm";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Spinner } from "@/components/ui/Spinner";
import { clampHebrewParts, hebrewPartsToGregorianYmd, todayHebrewParts } from "@/lib/hebrewDate";
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
  grade_levels: string[];
  class_ids: string[];
  track_ids: string[];
  target_label?: string;
  target_type_label?: string;
  year_label?: string;
};

type LookupItem = { id: string; name: string };

const emptyNewTarget = (): AssignmentTargetFormValue => ({
  gradeLevels: [],
  classIds: [],
  trackIds: [],
  specializationIds: [],
  psychologyEnabled: false,
  appliesToAllInGrade: false,
  category: "",
  teachingMode: "",
});

export function NewExamClient() {
  const router = useRouter();
  const { viewingYear, readOnly } = useAcademicYear();

  const [teacherId, setTeacherId] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"existing" | "new">("existing");

  const assignUrl = useMemo(() => {
    if (!teacherId) return null;
    const p = new URLSearchParams({ teacher_id: teacherId });
    return withYearQuery(`/api/teacher-assignments?${p.toString()}`, viewingYear?.id);
  }, [teacherId, viewingYear?.id]);

  const { data: aData, isLoading: aLoad } = useSWR<{ assignments: AssignmentRow[] }>(assignUrl, fetcher);
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

  const allAssignments = aData?.assignments ?? [];

  const [assignmentId, setAssignmentId] = useState("");
  const [examDate, setExamDate] = useState(() => {
    const ymd = hebrewPartsToGregorianYmd(clampHebrewParts(todayHebrewParts()));
    return ymd ?? "";
  });
  const [teachingTrackType, setTeachingTrackType] = useState<TeachingTrackType | "">("");

  const [newSubject, setNewSubject] = useState("");
  const [newLessonName, setNewLessonName] = useState("");
  const [newTarget, setNewTarget] = useState<AssignmentTargetFormValue>(emptyNewTarget);

  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => allAssignments.find((a) => a.id === assignmentId),
    [allAssignments, assignmentId],
  );

  const isTeachingTarget =
    assignmentMode === "existing"
      ? selected?.track_ids.length === 1 &&
        (selected?.target_label === TEACHING_TRACK_NAME ||
          selected?.target_label?.includes(TEACHING_TRACK_NAME))
      : newTarget.trackIds.length === 1 &&
        (trData?.items.find((t) => t.id === newTarget.trackIds[0])?.name ?? "") ===
          TEACHING_TRACK_NAME;

  useEffect(() => {
    setAssignmentId("");
    setAssignmentMode("existing");
    setNewTarget(emptyNewTarget());
  }, [teacherId]);

  useEffect(() => {
    if (teacherId && !aLoad && allAssignments.length === 0) {
      setAssignmentMode("new");
    }
  }, [teacherId, aLoad, allAssignments.length]);

  useEffect(() => {
    if (assignmentMode === "existing" && selected?.teaching_mode) {
      setTeachingTrackType(selected.teaching_mode);
    } else if (assignmentMode === "existing" && !isTeachingTarget) {
      setTeachingTrackType("");
    }
  }, [assignmentMode, selected?.id, selected?.teaching_mode, isTeachingTarget]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) {
      alert("שנה בארכיון — צפייה בלבד. עברי לשנה הפעילה.");
      return;
    }
    if (!teacherId) {
      alert("בחרי מורה מהרשימה (לא רק הקלדה — לחצי על השם ברשימה)");
      return;
    }
    if (!examDate) {
      alert("בחרי תאריך מבחן");
      return;
    }

    if (assignmentMode === "existing") {
      if (!selected) {
        alert("בחרי שיבוץ מהרשימה (שדה «שיבוץ»)");
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
      if (!newTarget.category) {
        alert("בחרי סוג שיבוץ: חובה או התמחות");
        return;
      }
      if (!newTarget.gradeLevels.length) {
        alert("בחרי לפחות שכבה אחת");
        return;
      }
      if (newTarget.category === "התמחות" && !newTarget.specializationIds.length) {
        alert("בחרי לפחות התמחות אחת");
        return;
      }
      if (
        newTarget.category === "חובה" &&
        !newTarget.appliesToAllInGrade &&
        !newTarget.classIds.length &&
        !newTarget.trackIds.length &&
        !newTarget.psychologyEnabled
      ) {
        alert("בחרי יעד: כיתות, מסלולים, פסיכולוגיה, או «כל השכבה»");
        return;
      }
      if (isTeachingTarget && !teachingTrackType) {
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
              teacher_assignment_id: selected!.id,
              teaching_track_type: isTeachingTarget ? teachingTrackType : null,
            }
          : {
              teacher_id: teacherId,
              exam_date: examDate,
              teaching_track_type: isTeachingTarget ? teachingTrackType : null,
              new_assignment: {
                subject: newSubject,
                lesson_name: newLessonName.trim() || null,
                assignment_category: newTarget.category as AssignmentCategory,
                grade_levels: newTarget.gradeLevels,
                class_ids: newTarget.classIds,
                track_ids: newTarget.trackIds,
                specialization_ids: newTarget.specializationIds,
                psychology_enabled: newTarget.psychologyEnabled,
                applies_to_all_in_grade: newTarget.appliesToAllInGrade,
                teaching_mode: newTarget.teachingMode || null,
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
      const studentsCount = (j as { students_count?: number }).students_count;
      if (typeof studentsCount === "number") {
        alert(`המבחן נוצר — שויכו ${studentsCount} תלמידות`);
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
            מורה → שיבוץ (כולל שכבות ויעדים) → תאריך. מבחן אחד לכל שיבוץ.
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

      <form
        noValidate
        onSubmit={submit}
        className="grid max-w-xl gap-4 rounded-xl border border-zinc-200 bg-white p-6"
      >
        {readOnly ? (
          <InlineNotice tone="error">
            צפייה בשנה בארכיון — לא ניתן ליצור מבחן. עברי לשנה הפעילה מהתפריט למעלה.
          </InlineNotice>
        ) : null}

        <TeacherSearchCombobox
          value={teacherId}
          onChange={(id) => setTeacherId(id)}
          disabled={readOnly}
          label="מורה"
        />

        {teacherId ? (
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
            <span className="text-sm font-medium text-zinc-700">שיבוץ (מקצוע · יעדים)</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={assignmentId}
              onChange={(e) => {
                setAssignmentId(e.target.value);
                setTeachingTrackType("");
              }}
              disabled={!teacherId || readOnly}
            >
              <option value="">— בחרי —</option>
              {allAssignments.map((a) => (
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
            ) : !allAssignments.length ? (
              <p className="mt-1 text-xs text-amber-800">אין שיבוצים למורה — עברי ל«שיבוץ חדש»</p>
            ) : selected ? (
              <p className="mt-1 text-xs text-zinc-600">
                יעדי השיבוץ: {selected.target_label ?? "—"}
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

            <AssignmentTargetForm
              value={newTarget}
              onChange={setNewTarget}
              classes={clData?.items ?? []}
              tracks={trData?.items ?? []}
              specializations={spData?.items ?? []}
              disabled={readOnly}
            />
          </fieldset>
        ) : null}

        {isTeachingTarget ? (
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">סוג הוראה במבחן *</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={teachingTrackType}
              onChange={(e) => setTeachingTrackType(e.target.value as TeachingTrackType | "")}
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
          disabled={readOnly}
        />

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving || readOnly}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
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
