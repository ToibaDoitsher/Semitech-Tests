"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  studentCount: number;
  estimatedPages: number;
};

export function StudentCardsPrintConfirmDialog({
  open,
  onClose,
  onConfirm,
  busy = false,
  studentCount,
  estimatedPages,
}: Props) {
  const idBase = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const pagesLabel =
    estimatedPages === studentCount
      ? `${estimatedPages} דפים (כרטיס אחד לכל תלמידה)`
      : `כ-${estimatedPages} דפים (לפחות ${studentCount} — תלמידות עם הרבה מבחנים עשויות לדרוש דף נוסף)`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="סגירה"
        onClick={() => !busy && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idBase}-title`}
        className="relative z-[101] w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-600 dark:bg-zinc-900"
      >
        <h2 id={`${idBase}-title`} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          הדפסת כרטיסי תלמידות
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          לפי הסינון הנוכחי יודפסו{" "}
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">{studentCount}</span> כרטיסים.
        </p>
        <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
          הערכת דפים: {pagesLabel}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          כל תלמידה מתחילה בדף חדש. הערות לא יודפסו.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm()}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? "מכין הדפסה…" : "הדפסה"}
          </button>
        </div>
      </div>
    </div>
  );
}
