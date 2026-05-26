"use client";

import { useEffect, useState } from "react";
import type { TeachingModeSelection } from "@/lib/teachers/teachingMode";
import { teachingModeSelectionLabel } from "@/lib/teachers/display";

export type { TeachingModeSelection } from "@/lib/teachers/teachingMode";

type Props = {
  open: boolean;
  initial?: TeachingModeSelection;
  onConfirm: (selection: TeachingModeSelection) => void;
  onCancel: () => void;
};

export function TeachingModePickerDialog({ open, initial = "", onConfirm, onCancel }: Props) {
  const [full, setFull] = useState(false);
  const [short, setShort] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial === "both") {
      setFull(true);
      setShort(true);
    } else if (initial === "full") {
      setFull(true);
      setShort(false);
    } else if (initial === "short") {
      setFull(false);
      setShort(true);
    } else {
      setFull(false);
      setShort(false);
    }
  }, [open, initial]);

  if (!open) return null;

  function confirm() {
    if (!full && !short) return;
    if (full && short) onConfirm("both");
    else if (full) onConfirm("full");
    else onConfirm("short");
  }

  const preview = full || short ? teachingModeSelectionLabel(full && short ? "both" : full ? "full" : "short") : "";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="סגירה" onClick={onCancel} />
      <div className="relative z-[101] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">סוג הוראה</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          נבחר מסלול הוראה — בחרי מלא, מקוצר, או את שניהם.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} />
            <span className="font-medium">מלא</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            <input type="checkbox" checked={short} onChange={(e) => setShort(e.target.checked)} />
            <span className="font-medium">מקוצר</span>
          </label>
        </div>

        {preview ? (
          <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-300">נבחר: {preview}</p>
        ) : (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">יש לבחור לפחות אחד</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600"
            onClick={onCancel}
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={!full && !short}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={confirm}
          >
            אישור
          </button>
        </div>
      </div>
    </div>
  );
}
