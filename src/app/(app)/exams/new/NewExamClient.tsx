"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery, withYearTermQuery } from "@/components/academicYears/AcademicYearProvider";
import {
  AssignmentTargetForm,
  type AssignmentTargetFormValue,
} from "@/components/assignments/AssignmentTargetForm";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Spinner } from "@/components/ui/Spinner";
import { clampHebrewParts, hebrewPartsToGregorianYmd, todayHebrewParts } from "@/lib/hebrewDate";
import { TeacherSearchCombobox } from "@/components/teachers/TeacherSearchCombobox";
import { TeachingModePickerDialog } from "@/components/assignments/TeachingModePickerDialog";
import { teachingModeSelectionLabel } from "@/lib/teachers/display";
import {
  examTeachingModeForSubmit,
  examTeachingTypeFromAssignment,
  findTeachingTrackId,
  isTeachingSelectionComplete,
  isTeachingTrackIdMatch,
  type TeachingModeSelection,
} from "@/lib/teachers/teachingMode";
import type { AssignmentCategory, TeachingTrackType } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type AssignmentRow = {
  id: string;
  subject: string;
  lesson_name?: string | null;
  teaching_mode?: TeachingTrackType | null;
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
  const { viewingYear, viewingTerm, readOnly } = useAcademicYear();

  const [teacherId, setTeacherId] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<"existing" | "new">("new");

  const assignUrl = useMemo(() => {
    if (!teacherId) return null;
    const p = new URLSearchParams({ teacher_id: teacherId });
    return withYearQuery(`/api/teacher-assignments?${p.toString()}`, viewingYear?.id);
  }, [teacherId, viewingYear?.id]);

  const { data: aData, isLoading: aLoad, error: aError } = useSWR<{ assignments: AssignmentRow[] }>(
    assignUrl,
    fetcher,
  );

  const needLookups = assignmentMode === "new";
  const { data: clData } = useSWR<{ items: LookupItem[] }>(
    assignmentMode === "new" ? withYearQuery("/api/lookups/classes", viewingYear?.id) : null,
    fetcher,
  );
  const { data: spData } = useSWR<{ items: LookupItem[] }>(
    assignmentMode === "new" ? withYearQuery("/api/lookups/specializations", viewingYear?.id) : null,
    fetcher,
  );
  const { data: trData } = useSWR<{ items: LookupItem[] }>(
    withYearQuery("/api/lookups/tracks", viewingYear?.id),
    fetcher,
  );

  const teachingTrackId = useMemo(
    () => findTeachingTrackId(trData?.items ?? []),
    [trData],
  );

  const allAssignments = aData?.assignments ?? [];

  const [assignmentId, setAssignmentId] = useState("");
  const [examDate, setExamDate] = useState(() => {
    const ymd = hebrewPartsToGregorianYmd(clampHebrewParts(todayHebrewParts()));
    return ymd ?? "";
  });

  const [newSubject, setNewSubject] = useState("");
  const [newLessonName, setNewLessonName] = useState("");
  const [newTarget, setNewTarget] = useState<AssignmentTargetFormValue>(emptyNewTarget);

  const [saving, setSaving] = useState(false);
  const [newTeachingDialogOpen, setNewTeachingDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selected = useMemo(
    () => allAssignments.find((a) => a.id === assignmentId),
    [allAssignments, assignmentId],
  );

  const isTeachingTarget =
    assignmentMode === "existing"
      ? Boolean(selected && isTeachingTrackIdMatch(selected.track_ids, teachingTrackId))
      : isTeachingTrackIdMatch(newTarget.trackIds, teachingTrackId);

  const inheritedTeachingType = useMemo(() => {
    if (assignmentMode !== "existing" || !selected) return null;
    return examTeachingTypeFromAssignment(selected.teaching_mode, isTeachingTarget);
  }, [assignmentMode, selected, isTeachingTarget]);

  function assignmentTeachingLabel(a: AssignmentRow): string {
    if (!isTeachingTrackIdMatch(a.track_ids, teachingTrackId)) return "";
    return teachingModeSelectionLabel(examTeachingTypeFromAssignment(a.teaching_mode, true) ?? "");
  }

  useEffect(() => {
    setAssignmentId("");
    setNewTarget(emptyNewTarget());
    if (allAssignments.length > 0) {
      setAssignmentMode("existing");
    } else {
      setAssignmentMode("new");
    }
  }, [teacherId, allAssignments.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (readOnly) {
      setFormError("שנה בארכיון — צפייה בלבד. עברי לשנה הפעילה.");
      return;
    }
    if (!teacherId) {
      setFormError("בחרי מורה מהרשימה (לא רק הקלדה — לחצי על השם ברשימה)");
      return;
    }
    if (!examDate) {
      setFormError("בחרי תאריך מבחן");
      return;
    }

    if (assignmentMode === "existing") {
      if (!selected) {
        setFormError("בחרי שיבוץ מהרשימה (שדה «שיבוץ»)");
        return;
      }
      const assignmentTeaching = examTeachingTypeFromAssignment(selected.teaching_mode, true) ?? "";
      if (isTeachingTarget && !isTeachingSelectionComplete(assignmentTeaching)) {
        setFormError("בשיבוץ זה חסר סוג הוראה — ערכי את השיבוץ ברשימת השיבוצים (מלא / מקוצר)");
        return;
      }
    } else {
      if (!newSubject.trim() && !newLessonName.trim()) {
        setFormError("מלאי מקצוע או שם שיעור (לפחות אחד)");
        return;
      }
      if (!newTarget.category) {
        setFormError("בחרי סוג שיבוץ: חובה או התמחות");
        return;
      }
      if (!newTarget.gradeLevels.length) {
        setFormError("בחרי לפחות שכבה אחת");
        return;
      }
      if (newTarget.category === "התמחות" && !newTarget.specializationIds.length) {
        setFormError("בחרי לפחות התמחות אחת");
        return;
      }
      if (
        newTarget.category === "חובה" &&
        !newTarget.appliesToAllInGrade &&
        !newTarget.classIds.length &&
        !newTarget.trackIds.length &&
        !newTarget.psychologyEnabled
      ) {
        setFormError("בחרי יעד: כיתות, מסלולים, פסיכולוגיה, או «כל השכבה»");
        return;
      }
      if (isTeachingTarget && !isTeachingSelectionComplete(newTarget.teachingMode)) {
        setFormError("במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)");
        return;
      }
    }

    setSaving(true);
    try {
      const submitTeachingMode =
        assignmentMode === "existing"
          ? isTeachingTarget
            ? examTeachingModeForSubmit(
                examTeachingTypeFromAssignment(selected!.teaching_mode, true) ?? "",
              )
            : null
          : isTeachingSelectionComplete(newTarget.teachingMode)
            ? examTeachingModeForSubmit(newTarget.teachingMode)
            : null;

      const body =
        assignmentMode === "existing"
          ? {
              teacher_id: teacherId,
              subject: selected!.subject,
              exam_date: examDate,
              teacher_assignment_id: selected!.id,
              teaching_mode: submitTeachingMode,
            }
          : {
              teacher_id: teacherId,
              exam_date: examDate,
              teaching_mode: submitTeachingMode,
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
                teaching_mode: submitTeachingMode,
              },
            };

      const r = await fetch(withYearTermQuery("/api/exams", viewingYear?.id, viewingTerm), {
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
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const showExistingPicker = assignmentMode === "existing";
  const showNewForm = assignmentMode === "new";
  const canPickExisting = allAssignments.length > 0;
  const detailsLocked = !teacherId || readOnly;

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

      <ol className="grid max-w-xl gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <li className={teacherId ? "text-emerald-800" : "font-medium text-zinc-900"}>
          1. בחרי מורה מהרשימה (לא רק הקלדה)
        </li>
        <li className={teacherId ? "font-medium text-zinc-900" : ""}>
          2. מלאי פרטי שיבוץ — מקצוע, שכבות, כיתות/מסלולים
        </li>
        <li>3. בחרי תאריך מבחן עברי</li>
      </ol>

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

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-800">שלב 1 — מורה</h2>
          <TeacherSearchCombobox
            value={teacherId}
            onChange={(id) => setTeacherId(id)}
            disabled={readOnly}
            label="מורה"
          />
        </section>

        <section
          className={`space-y-3 rounded-lg border p-4 ${
            detailsLocked ? "border-zinc-100 bg-zinc-50/80 opacity-90" : "border-zinc-200 bg-white"
          }`}
        >
          <h2 className="text-sm font-semibold text-zinc-800">שלב 2 — שיבוץ</h2>

          {!teacherId ? (
            <p className="text-sm text-amber-900">בחרי מורה בשלב 1 — ואז תוכלי למלא את פרטי השיבוץ כאן.</p>
          ) : null}

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
                disabled={detailsLocked}
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
              disabled={detailsLocked}
            >
              {canPickExisting ? "שיבוץ חדש" : "יצירת שיבוץ ומבחן"}
            </button>
          </div>

          <fieldset disabled={detailsLocked} className="min-w-0 space-y-3 border-0 p-0">
            {showExistingPicker ? (
              <label className="block">
                <span className="text-sm font-medium text-zinc-700">שיבוץ (מקצוע · יעדים)</span>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 disabled:bg-zinc-50"
                  value={assignmentId}
                  onChange={(e) => setAssignmentId(e.target.value)}
                >
                  <option value="">— בחרי —</option>
                  {allAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.year_label ? `${a.year_label} · ` : ""}
                      {a.subject}
                      {a.lesson_name ? ` · ${a.lesson_name}` : ""}
                      {assignmentTeachingLabel(a) ? ` · ${assignmentTeachingLabel(a)}` : ""}
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
                ) : aError ? (
                  <p className="mt-1 text-xs text-red-700">
                    שגיאה בטעינת שיבוצים — השתמשי ב«שיבוץ חדש» או פני למנהלת מערכת
                  </p>
                ) : !allAssignments.length ? (
                  <p className="mt-1 text-xs text-amber-800">אין שיבוצים למורה — מלאי «שיבוץ חדש» למטה</p>
                ) : selected ? (
                  <p className="mt-1 text-xs text-zinc-600">
                    יעדי השיבוץ: {selected.target_label ?? "—"}
                    {inheritedTeachingType ? (
                      <>
                        {" · "}
                        סוג הוראה: {teachingModeSelectionLabel(inheritedTeachingType)}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </label>
            ) : null}

            {showNewForm ? (
              <div className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
                <p className="text-sm font-medium text-zinc-800">פרטי שיבוץ חדש</p>

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
                  disabled={detailsLocked}
                />
              </div>
            ) : null}
          </fieldset>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-800">שלב 3 — תאריך</h2>
          {isTeachingTarget && assignmentMode === "existing" && inheritedTeachingType ? (
            <p className="text-sm text-zinc-700">
              סוג הוראה מהשיבוץ:{" "}
              <span className="font-medium">{teachingModeSelectionLabel(inheritedTeachingType)}</span>
            </p>
          ) : null}

          {isTeachingTarget && assignmentMode === "new" ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm">
              <span className="font-medium text-zinc-800">סוג הוראה במבחן: </span>
              {newTarget.teachingMode ? (
                <span>{teachingModeSelectionLabel(newTarget.teachingMode)}</span>
              ) : (
                <span className="text-amber-800">לא נבחר — חובה</span>
              )}
              <button
                type="button"
                disabled={detailsLocked}
                className="ms-2 text-sky-800 underline hover:no-underline"
                onClick={() => setNewTeachingDialogOpen(true)}
              >
                {newTarget.teachingMode ? "שינוי" : "בחירה"}
              </button>
            </div>
          ) : null}

          <HebrewDatePicker
            label="תאריך מבחן (עברי)"
            value={examDate}
            onChange={setExamDate}
            disabled={readOnly}
          />
        </section>

        {formError ? (
          <InlineNotice tone="error">
            <div className="space-y-1">
              <p className="font-semibold">לא ניתן ליצור את המבחן</p>
              <p className="text-sm leading-relaxed">{formError}</p>
            </div>
          </InlineNotice>
        ) : null}

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

      <TeachingModePickerDialog
        open={newTeachingDialogOpen}
        initial={newTarget.teachingMode}
        onConfirm={(selection: TeachingModeSelection) => {
          setNewTarget((prev) => ({ ...prev, teachingMode: selection }));
          setNewTeachingDialogOpen(false);
        }}
        onCancel={() => setNewTeachingDialogOpen(false)}
      />
    </div>
  );
}
