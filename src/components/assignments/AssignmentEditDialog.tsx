"use client";

import { useEffect } from "react";
import {
  AssignmentTargetForm,
  type AssignmentTargetFormValue,
} from "@/components/assignments/AssignmentTargetForm";
import { TeacherSearchCombobox } from "@/components/teachers/TeacherSearchCombobox";

export type AssignmentEditDraft = {
  teacher_id: string;
  subject: string;
  lesson_name: string;
} & AssignmentTargetFormValue;

type LookupItem = { id: string; name: string };

type Props = {
  open: boolean;
  draft: AssignmentEditDraft | null;
  onDraftChange: (draft: AssignmentEditDraft) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  busy?: boolean;
  title?: string;
  classes: LookupItem[];
  tracks: LookupItem[];
  specializations: LookupItem[];
};

export function AssignmentEditDialog({
  open,
  draft,
  onDraftChange,
  onClose,
  onSave,
  busy = false,
  title = "עריכת שיבוץ",
  classes,
  tracks,
  specializations,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open || !draft) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="סגירה"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[101] flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="shrink-0 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <TeacherSearchCombobox
            value={draft.teacher_id}
            onChange={(id) => onDraftChange({ ...draft, teacher_id: id })}
            required
          />

          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">מקצוע</span>
            <input
              value={draft.subject}
              onChange={(e) => onDraftChange({ ...draft, subject: e.target.value })}
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800"
              placeholder="גרפיקה, הנה״ח…"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">שם שיעור</span>
            <input
              value={draft.lesson_name}
              onChange={(e) => onDraftChange({ ...draft, lesson_name: e.target.value })}
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800"
              placeholder="פוטושופ 1…"
            />
            <p className="mt-1 text-xs text-zinc-500">מקצוע או שם שיעור — חובה למלא אחד מהם</p>
          </label>

          <AssignmentTargetForm
            value={draft}
            onChange={(next) => onDraftChange({ ...draft, ...next })}
            classes={classes}
            tracks={tracks}
            specializations={specializations}
            disabled={busy}
          />
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-700">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSave()}
            className="rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
