"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: { completed_at: string; notes: string }) => void | Promise<void>;
  busy?: boolean;
  title?: string;
};

function defaultDateLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultTimeLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CompleteMakeupDialog({
  open,
  onClose,
  onSave,
  busy = false,
  title = "סימון השלמה",
}: Props) {
  const idBase = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(defaultDateLocal);
  const [time, setTime] = useState(defaultTimeLocal);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(defaultDateLocal());
    setTime(defaultTimeLocal());
    setNotes("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function handleSave() {
    if (!date || !time || busy) return;
    const completed_at = new Date(`${date}T${time}`).toISOString();
    await onSave({ completed_at, notes: notes.trim() });
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
        <p className="mt-1 text-sm text-zinc-600">תאריך ושעת השלמה + הערות אופציונליות</p>

        <div className="mt-4 grid gap-3">
          <label className="block text-sm font-medium text-zinc-700">
            תאריך השלמה
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            שעה
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            הערות
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
              rows={3}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium"
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={busy || !date || !time}
            onClick={() => void handleSave()}
            className="rounded-xl border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
