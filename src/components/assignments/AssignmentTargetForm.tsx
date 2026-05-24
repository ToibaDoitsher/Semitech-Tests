"use client";

import type { GradeLevel } from "@/lib/academicYears/types";
import { GradeLevelCheckboxes } from "@/components/gradeLevels/GradeLevelCheckboxes";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import type { AssignmentCategory, TeachingMode } from "@/lib/types/db";

type LookupItem = { id: string; name: string };

export type AssignmentTargetFormValue = {
  gradeLevels: GradeLevel[];
  classIds: string[];
  trackIds: string[];
  specializationIds: string[];
  psychologyEnabled: boolean;
  appliesToAllInGrade: boolean;
  category: "" | AssignmentCategory;
  teachingMode: TeachingMode | "";
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
  const showMandatory = value.category === "חובה";
  const showSpec = value.category === "התמחות";
  const selectedTrackName =
    value.trackIds.length === 1
      ? (tracks.find((t) => t.id === value.trackIds[0])?.name ?? "")
      : "";
  const showTeachingMode =
    showMandatory && value.trackIds.length === 1 && selectedTrackName === TEACHING_TRACK_NAME;

  function patch(partial: Partial<AssignmentTargetFormValue>) {
    onChange({ ...value, ...partial });
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
                        onChange={() => patch({ trackIds: toggleId(value.trackIds, o.id) })}
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

      {showTeachingMode ? (
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">סוג הוראה</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={value.teachingMode}
            disabled={disabled}
            onChange={(e) => patch({ teachingMode: e.target.value as TeachingMode | "" })}
          >
            <option value="">— ללא סינון —</option>
            <option value="full">מלא</option>
            <option value="short">מקוצר</option>
          </select>
        </label>
      ) : null}
    </div>
  );
}
