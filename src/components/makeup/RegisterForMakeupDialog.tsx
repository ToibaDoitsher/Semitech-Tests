"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HebrewDatePicker } from "@/components/ui/HebrewDatePicker";

export type RegisterForMakeupPayload = {
  completed_at: string;
  starting_grade: number | null;
  is_paid: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (payload: RegisterForMakeupPayload) => void | Promise<void>;
  busy?: boolean;
  studentLabel?: string;
};

export function RegisterForMakeupDialog({
  open,
  onClose,
  onSave,
  busy = false,
  studentLabel,
}: Props) {
  const idBase = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState("");
  const [startingGrade, setStartingGrade] = useState("");
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate("");
    setStartingGrade("");
    setIsPaid(false);
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
    if (!date.trim() || busy) return;
    let grade: number | null = null;
    if (startingGrade.trim()) {
      const n = Number(startingGrade.replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        alert("ציון התחלה חייב להיות מספר בין 0 ל-100");
        return;
      }
      grade = n;
    }
    const completed_at = new Date(`${date.trim()}T12:00:00`).toISOString();
    await onSave({ completed_at, starting_grade: grade, is_paid: isPaid });
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
          נרשמה להשלמה
        </h2>
        {studentLabel ? (
          <p className="mt-1 text-sm text-zinc-600">{studentLabel}</p>
        ) : null}
        <p className="mt-2 text-sm text-zinc-500">מלאי את פרטי ההשלמה</p>

        <div className="mt-4 grid gap-4">
          <HebrewDatePicker label="תאריך השלמה" value={date} onChange={setDate} />
          <label className="block text-sm font-medium text-zinc-700">
            מאיזה ציון מתחיל המבחן
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={startingGrade}
              onChange={(e) => setStartingGrade(e.target.value)}
              disabled={busy}
              placeholder="0–100 (אופציונלי)"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <fieldset className="block">
            <legend className="text-sm font-medium text-zinc-700">בתשלום</legend>
            <div className="mt-2 flex gap-2">
              {(
                [
                  { value: false, label: "לא" },
                  { value: true, label: "כן" },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  disabled={busy}
                  onClick={() => setIsPaid(opt.value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    isPaid === opt.value
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
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
            disabled={busy || !date.trim()}
            onClick={() => void handleSave()}
            className="rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
