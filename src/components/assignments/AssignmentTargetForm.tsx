"use client";

import { useMemo, useState } from "react";
import type { GradeLevel } from "@/lib/academicYears/types";
import { GradeLevelCheckboxes } from "@/components/gradeLevels/GradeLevelCheckboxes";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import type { AssignmentCategory } from "@/lib/types/db";
import { teachingModeSelectionLabel } from "@/lib/teachers/display";
import type { TeachingModeSelection } from "@/lib/teachers/teachingMode";
import { TeachingModePickerDialog } from "@/components/assignments/TeachingModePickerDialog";

type LookupItem = { id: string; name: string };

export type AssignmentTargetFormValue = {
  gradeLevels: GradeLevel[];
  classIds: string[];
  trackIds: string[];
  specializationIds: string[];
  psychologyEnabled: boolean;
  appliesToAllInGrade: boolean;
  category: "" | AssignmentCategory;
  teachingMode: TeachingModeSelection;
};

type Props = {
  value: AssignmentTargetFormValue;
  onChange: (next: AssignmentTargetFormValue) => void;
  classes: LookupItem[];
  tracks: LookupItem[];
  specializations: LookupItem[];
  disabled?: boolean;
};

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function AssignmentTargetForm({
  value,
  onChange,
  classes,
  tracks,
  specializations,
  disabled,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const teachingTrackId = useMemo(
    () => tracks.find((t) => t.name === TEACHING_TRACK_NAME)?.id ?? "",
    [tracks],
  );

  const showMandatory = value.category === "חובה";
  const showSpec = value.category === "התמחות";
  const showTeachingMode =
    showMandatory &&
    value.trackIds.length === 1 &&
    value.trackIds[0] === teachingTrackId &&
    Boolean(teachingTrackId);

  function patch(partial: Partial<AssignmentTargetFormValue>) {
    onChange({ ...value, ...partial });
  }

  function openTeachingDialog() {
    if (!disabled) setDialogOpen(true);
  }

  function onTrackToggle(trackId: string) {
    const nextIds = toggleId(value.trackIds, trackId);
    const wasOnlyTeaching =
      value.trackIds.length === 1 && value.trackIds[0] === teachingTrackId;
    const willBeOnlyTeaching =
      nextIds.length === 1 && nextIds[0] === teachingTrackId && Boolean(teachingTrackId);

    if (!wasOnlyTeaching && willBeOnlyTeaching) {
      patch({ trackIds: nextIds, teachingMode: "" });
      openTeachingDialog();
      return;
    }

    if (wasOnlyTeaching && !nextIds.includes(teachingTrackId)) {
      patch({ trackIds: nextIds, teachingMode: "" });
      return;
    }

    if (nextIds.length !== 1 || nextIds[0] !== teachingTrackId) {
      patch({ trackIds: nextIds, teachingMode: "" });
      return;
    }

    patch({ trackIds: nextIds });
  }

  function onTeachingConfirm(selection: TeachingModeSelection) {
    patch({ teachingMode: selection });
    setDialogOpen(false);
  }

  function onTeachingCancel() {
    setDialogOpen(false);
    if (!value.teachingMode && value.trackIds.length === 1 && value.trackIds[0] === teachingTrackId) {
      patch({ trackIds: [], teachingMode: "" });
    }
  }

  return (
    <div className="space-y-4">
      <GradeLevelCheckboxes
        value={value.gradeLevels}
        onChange={(gradeLevels) => patch({ gradeLevels })}
        disabled={disabled}
        hint="שיבוץ אחד — כל השכבות והיעדים שנבחרו ביחד"
      />

      <div>
        <span className="text-sm font-medium text-zinc-700">סוג שיבוץ *</span>
        <div className="mt-2 flex flex-wrap gap-4">
          {(["חובה", "התמחות"] as const).map((opt) => (
            <label key={opt} className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="assignment_category_form"
                checked={value.category === opt}
                disabled={disabled}
                onChange={() => {
                  if (opt === "חובה") patch({ category: opt, specializationIds: [] });
                  else
                    patch({
                      category: opt,
                      classIds: [],
                      trackIds: [],
                      psychologyEnabled: false,
                      appliesToAllInGrade: false,
                      teachingMode: "",
                    });
                }}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      {showMandatory ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.appliesToAllInGrade}
              disabled={disabled}
              onChange={(e) => {
                const on = e.target.checked;
                patch({
                  appliesToAllInGrade: on,
                  classIds: on ? [] : value.classIds,
                  trackIds: on ? [] : value.trackIds,
                  psychologyEnabled: on ? false : value.psychologyEnabled,
                  teachingMode: on ? "" : value.teachingMode,
                });
              }}
            />
            <span className="font-medium text-zinc-700">כל השכבה (כל התלמידות בשכבות שנבחרו)</span>
          </label>

          {!value.appliesToAllInGrade ? (
            <>
              <p className="text-xs text-zinc-500">
                ניתן לבחור שילוב — כיתות + מסלולים + פסיכולוגיה. כל יעד שנבחר ייכלל בשיבוץ. צריך לבחור לפחות יעד אחד.
              </p>
              <fieldset className="block">
                <legend className="text-sm font-medium text-zinc-700">כיתות</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {classes.map((o) => (
                    <label
                      key={o.id}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={value.classIds.includes(o.id)}
                        onChange={() => patch({ classIds: toggleId(value.classIds, o.id) })}
                      />
                      {o.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="block">
                <legend className="text-sm font-medium text-zinc-700">מסלולים</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tracks.map((o) => (
                    <label
                      key={o.id}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={value.trackIds.includes(o.id)}
                        onChange={() => onTrackToggle(o.id)}
                      />
                      {o.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.psychologyEnabled}
                  disabled={disabled}
                  onChange={(e) => patch({ psychologyEnabled: e.target.checked })}
                />
                מיועד לפסיכולוגיה
              </label>

              {showTeachingMode ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-sm">
                  <span className="font-medium text-zinc-800">סוג הוראה: </span>
                  {value.teachingMode ? (
                    <span>{teachingModeSelectionLabel(value.teachingMode)}</span>
                  ) : (
                    <span className="text-amber-800">לא נבחר — חובה</span>
                  )}
                  <button
                    type="button"
                    disabled={disabled}
                    className="ms-2 text-sky-800 underline hover:no-underline"
                    onClick={openTeachingDialog}
                  >
                    {value.teachingMode ? "שינוי" : "בחירה"}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {showSpec ? (
        <fieldset className="block">
          <legend className="text-sm font-medium text-zinc-700">התמחויות *</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {specializations.map((o) => (
              <label
                key={o.id}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={value.specializationIds.includes(o.id)}
                  onChange={() =>
                    patch({ specializationIds: toggleId(value.specializationIds, o.id) })
                  }
                />
                {o.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <TeachingModePickerDialog
        open={dialogOpen}
        initial={value.teachingMode}
        onConfirm={onTeachingConfirm}
        onCancel={onTeachingCancel}
      />
    </div>
  );
}
