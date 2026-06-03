"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Spinner } from "@/components/ui/Spinner";
import { TeacherSearchCombobox } from "@/components/teachers/TeacherSearchCombobox";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import { teachingModeSelectionLabel } from "@/lib/teachers/display";
import {
  findTeachingTrackId,
  isTeachingSelectionComplete,
  isTeachingTrackIdMatch,
  teachingModeFromExamDb,
} from "@/lib/teachers/teachingMode";
import {
  TeachingModePickerDialog,
  type TeachingModeSelection,
} from "@/components/assignments/TeachingModePickerDialog";
import type { AssignmentCategory, TeachingTrackType } from "@/lib/types/db";

type LookupItem = { id: string; name: string };

type Props = {
  examId: string;
  onClose: () => void;
  onSaved: (summary: SaveSummary | null) => void;
  initial: {
    exam_date: string;
    assignment_category: AssignmentCategory;
    grade_levels: string[];
    class_ids: string[];
    track_ids: string[];
    specialization_ids: string[];
    psychology_enabled: boolean;
    applies_to_all_in_grade: boolean;
    teaching_track_type: TeachingTrackType | null;
    teacher_id: string;
  };
  locked: boolean;
};

export type SaveSummary = {
  added: number;
  removedExamStudents: number;
  removedMakeups: number;
  removedTracking: number;
  teacherCascade?: {
    assignment_updated: boolean;
    exams_updated: number;
    snapshots_updated: number;
  } | null;
};

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

const chipClass =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800";

export function ExamEditDialog({ examId, onClose, onSaved, initial, locked }: Props) {
  const { viewingYear } = useAcademicYear();
  const yearId = viewingYear?.id;

  const { data: clData } = useSWR<{ items: LookupItem[] }>(
    withYearQuery("/api/lookups/classes", yearId),
    fetcher,
  );
  const { data: spData } = useSWR<{ items: LookupItem[] }>(
    withYearQuery("/api/lookups/specializations", yearId),
    fetcher,
  );
  const { data: trData } = useSWR<{ items: LookupItem[] }>(
    withYearQuery("/api/lookups/tracks", yearId),
    fetcher,
  );

  const [examDate, setExamDate] = useState(initial.exam_date);
  const [teacherId, setTeacherId] = useState<string>(initial.teacher_id);
  const teacherChanged = teacherId !== initial.teacher_id;
  const [grades, setGrades] = useState<string[]>(initial.grade_levels);
  const [classIds, setClassIds] = useState<string[]>(initial.class_ids);
  const [trackIds, setTrackIds] = useState<string[]>(initial.track_ids);
  const [specIds, setSpecIds] = useState<string[]>(initial.specialization_ids);
  const [psychology, setPsychology] = useState(initial.psychology_enabled);
  const [appliesAll, setAppliesAll] = useState(initial.applies_to_all_in_grade);
  const [teachingMode, setTeachingMode] = useState<TeachingModeSelection>(() => {
    if (initial.teaching_track_type === "full" || initial.teaching_track_type === "short") {
      return initial.teaching_track_type;
    }
    return "";
  });
  const [teachingDialogOpen, setTeachingDialogOpen] = useState(false);
  const teachingModeTouchedRef = useRef(false);

  useEffect(() => {
    if (teachingModeTouchedRef.current) return;
    const teachingId = findTeachingTrackId(trData?.items ?? []);
    const isTeaching = isTeachingTrackIdMatch(initial.track_ids, teachingId);
    setTeachingMode(teachingModeFromExamDb(initial.teaching_track_type, isTeaching));
  }, [initial.teaching_track_type, initial.track_ids, trData]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showSpec = initial.assignment_category === "התמחות";
  const showMandatory = initial.assignment_category === "חובה";

  const selectedTrackName = useMemo(() => {
    if (trackIds.length !== 1) return "";
    return (trData?.items ?? []).find((t) => t.id === trackIds[0])?.name ?? "";
  }, [trackIds, trData]);
  const showTeachingMode = showMandatory && selectedTrackName === TEACHING_TRACK_NAME;

  const effectiveTeachingMode = useMemo((): TeachingModeSelection => {
    if (isTeachingSelectionComplete(teachingMode)) return teachingMode;
    const teachingId = findTeachingTrackId(trData?.items ?? []);
    if (!isTeachingTrackIdMatch(trackIds, teachingId)) return "";
    return teachingModeFromExamDb(initial.teaching_track_type, true);
  }, [teachingMode, trData, trackIds, initial.teaching_track_type]);

  async function save() {
    if (showTeachingMode && !isTeachingSelectionComplete(effectiveTeachingMode)) {
      setError("במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)");
      return;
    }
    if (!teacherId) {
      setError("חובה לבחור מורה");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(withYearQuery(`/api/exams/${examId}`, yearId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_date: examDate,
          teacher_id: teacherChanged ? teacherId : undefined,
          grade_levels: locked ? undefined : grades,
          class_ids: locked ? undefined : classIds,
          track_ids: locked ? undefined : trackIds,
          specialization_ids: locked ? undefined : specIds,
          psychology_enabled: locked ? undefined : psychology,
          applies_to_all_in_grade: locked ? undefined : appliesAll,
          teaching_track_type:
            locked || !showTeachingMode
              ? undefined
              : effectiveTeachingMode,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        sync?: SaveSummary | null;
        teacher_cascade?: SaveSummary["teacherCascade"];
      };
      if (!r.ok) throw new Error(j.error ?? "שמירה נכשלה");
      const summary: SaveSummary = {
        added: j.sync?.added ?? 0,
        removedExamStudents: j.sync?.removedExamStudents ?? 0,
        removedMakeups: j.sync?.removedMakeups ?? 0,
        removedTracking: j.sync?.removedTracking ?? 0,
        teacherCascade: j.teacher_cascade ?? null,
      };
      onSaved(summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="סגירה"
        onClick={() => !busy && onClose()}
      />
      <div className="relative z-[101] flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-slate-200 p-4 dark:border-zinc-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">עריכת מבחן</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            עדכון תאריך ויעד · שורות תלמידות יסונכרנו אוטומטית (יתווספו/יוסרו ובהתאם גם השלמות ומעקב)
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {locked ? (
            <InlineNotice tone="warning">
              המבחן ננעל להשלמות — ניתן לעדכן רק את התאריך.
            </InlineNotice>
          ) : null}

          <div>
            <HebrewDatePicker value={examDate} onChange={setExamDate} required disabled={busy} />
          </div>

          <div className="space-y-2">
            <TeacherSearchCombobox
              value={teacherId}
              onChange={(id) => setTeacherId(id)}
              disabled={busy}
              required
              label="מורה אחראית"
            />
            {teacherChanged ? (
              <InlineNotice tone="warning">
                שינוי המורה יעדכן את <strong>השיבוץ-המקור</strong> ואת{" "}
                <strong>כל המבחנים האחרים</strong> שנוצרו מאותו שיבוץ, כולל שם המורה
                בכל שורות התלמידות. הפעולה לא הפיכה ללא ביטול ידני.
              </InlineNotice>
            ) : null}
          </div>

          {!locked ? (
            <>
              <div>
                <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">שכבות</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["א", "ב", "ג"] as const).map((g) => (
                    <label key={g} className={chipClass}>
                      <input
                        type="checkbox"
                        checked={grades.includes(g)}
                        disabled={busy}
                        onChange={() => setGrades(toggleId(grades, g))}
                      />
                      שכבה {g}
                    </label>
                  ))}
                </div>
              </div>

              {showMandatory ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={appliesAll}
                      disabled={busy}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setAppliesAll(on);
                        if (on) {
                          setClassIds([]);
                          setTrackIds([]);
                          setPsychology(false);
                        }
                      }}
                    />
                    <span className="font-medium text-slate-700 dark:text-zinc-300">
                      כל השכבה (כל התלמידות בשכבות שנבחרו)
                    </span>
                  </label>

                  {!appliesAll ? (
                    <>
                      <fieldset>
                        <legend className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                          כיתות
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(clData?.items ?? []).map((o) => (
                            <label key={o.id} className={chipClass}>
                              <input
                                type="checkbox"
                                checked={classIds.includes(o.id)}
                                disabled={busy}
                                onChange={() => setClassIds(toggleId(classIds, o.id))}
                              />
                              {o.name}
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset>
                        <legend className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                          מסלולים
                        </legend>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(trData?.items ?? []).map((o) => (
                            <label key={o.id} className={chipClass}>
                              <input
                                type="checkbox"
                                checked={trackIds.includes(o.id)}
                                disabled={busy}
                                onChange={() => {
                                const next = toggleId(trackIds, o.id);
                                setTrackIds(next);
                                const teachingId = (trData?.items ?? []).find(
                                  (t) => t.name === TEACHING_TRACK_NAME,
                                )?.id;
                                const onlyTeaching =
                                  next.length === 1 && next[0] === teachingId && Boolean(teachingId);
                                if (onlyTeaching && !trackIds.includes(o.id)) {
                                  setTeachingDialogOpen(true);
                                } else if (!onlyTeaching) {
                                  setTeachingMode("");
                                }
                              }}
                              />
                              {o.name}
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={psychology}
                          disabled={busy}
                          onChange={(e) => setPsychology(e.target.checked)}
                        />
                        מיועד לפסיכולוגיה
                      </label>

                      {showTeachingMode ? (
                        <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm">
                          <span className="font-semibold text-slate-700 dark:text-zinc-300">
                            סוג הוראה:{" "}
                          </span>
                          {effectiveTeachingMode ? (
                            <span>{teachingModeSelectionLabel(effectiveTeachingMode)}</span>
                          ) : (
                            <span className="text-amber-800">לא נבחר — חובה</span>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            className="ms-2 text-sky-800 underline hover:no-underline"
                            onClick={() => setTeachingDialogOpen(true)}
                          >
                            {effectiveTeachingMode ? "שינוי" : "בחירה"}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}

              {showSpec ? (
                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                    התמחויות *
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(spData?.items ?? []).map((o) => (
                      <label key={o.id} className={chipClass}>
                        <input
                          type="checkbox"
                          checked={specIds.includes(o.id)}
                          disabled={busy}
                          onChange={() => setSpecIds(toggleId(specIds, o.id))}
                        />
                        {o.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </>
          ) : null}

          {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4 dark:border-zinc-700">
          <button
            type="button"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            disabled={busy}
            onClick={onClose}
          >
            ביטול
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? <Spinner className="size-4" /> : null}
            {busy ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>

      <TeachingModePickerDialog
        open={teachingDialogOpen}
        initial={teachingMode}
        onConfirm={(selection) => {
          teachingModeTouchedRef.current = true;
          setTeachingMode(selection);
          setTeachingDialogOpen(false);
        }}
        onCancel={() => {
          setTeachingDialogOpen(false);
          if (!teachingMode && trackIds.length === 1) {
            const teachingId = (trData?.items ?? []).find((t) => t.name === TEACHING_TRACK_NAME)?.id;
            if (teachingId && trackIds[0] === teachingId) {
              setTrackIds([]);
            }
          }
        }}
      />
    </div>
  );
}
