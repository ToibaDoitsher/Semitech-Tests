"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** טקסט משנה ארוך (אזהרות) */
  hint?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  /** אם מוגדר — יש להקליד בדיוק לפני אישור */
  requiredPhrase?: string;
};

export function ConfirmDangerDialog({
  open,
  onClose,
  title,
  description,
  hint,
  confirmLabel = "מחק",
  cancelLabel = "ביטול",
  onConfirm,
  busy = false,
  requiredPhrase,
}: Props) {
  const idBase = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    if (!open) setPhrase("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>("input[data-confirm-phrase]")?.focus();
  }, [open]);

  if (!open) return null;

  const phraseOk = !requiredPhrase || phrase.trim() === requiredPhrase;

  async function handleConfirm() {
    if (!phraseOk || busy) return;
    await onConfirm();
  }

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
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{description}</p> : null}
        {hint ? <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{hint}</p> : null}
        {requiredPhrase ? (
          <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            לאישור הקלידי בדיוק: <span className="font-mono text-red-700">{requiredPhrase}</span>
            <input
              data-confirm-phrase
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              disabled={busy}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 dark:border-zinc-600 dark:bg-zinc-800"
              dir="rtl"
              autoComplete="off"
            />
          </label>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy || !phraseOk}
            onClick={() => void handleConfirm()}
            className="rounded-xl border border-red-800 bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-800 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "מוחק…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
