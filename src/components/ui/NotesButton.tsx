"use client";

import { MessageSquare, MessageSquareText } from "lucide-react";
import { useCallback, useState } from "react";
type Entity = "students" | "exams" | "makeups" | "exam-students";

const EXAM_STUDENTS_PATCH_HINT =
  "הערות לתלמידה במבחן דורשות הרצה חד-פעמית ב-Supabase:\n\nalter table public.exam_students add column if not exists notes text;\n\n(קובץ: supabase/PATCH_EXAM_STUDENTS_NOTES.sql)";

function formatNotesError(entity: Entity, err: string): string {
  if (entity === "exam-students" && /notes|schema|column|לא נמצא/i.test(err)) {
    return EXAM_STUDENTS_PATCH_HINT;
  }
  return err;
}

type Props = {
  entity: Entity;
  id: string;
  label?: string;
  /** כותרת בחלון העריכה */
  modalTitle?: string;
  /** מצב קומפקטי — איקון + תווית, מתאים לתאי טבלה */
  compact?: boolean;
  hasNote?: boolean;
  onSaved?: (notes: string) => void;
};

export function NotesButton({
  entity,
  id,
  label = "הערות",
  modalTitle,
  compact = false,
  hasNote = false,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localHas, setLocalHas] = useState(hasNote);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/notes/${entity}/${id}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(formatNotesError(entity, (j as { error?: string }).error ?? "שגיאה"));
      const v = (j as { notes?: string }).notes ?? "";
      setNotes(v);
      setLocalHas(v.trim().length > 0);
    } catch (e) {
      alert((e as Error).message);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [entity, id]);

  async function openModal() {
    setOpen(true);
    await load();
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/notes/${entity}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(formatNotesError(entity, (j as { error?: string }).error ?? "שגיאה"));
      const saved = (j as { notes?: string }).notes ?? "";
      setLocalHas(saved.trim().length > 0);
      setOpen(false);
      onSaved?.(saved);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const showFilled = localHas || hasNote;
  const Icon = showFilled ? MessageSquareText : MessageSquare;
  const dialogTitle = modalTitle ?? label;

  const buttonClass = compact
    ? [
        "relative inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition",
        showFilled
          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
      ].join(" ")
    : [
        "relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
        showFilled
          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
      ].join(" ");

  return (
    <>
      <button
        type="button"
        onClick={() => void openModal()}
        className={buttonClass}
        title={showFilled ? `${label} — לחצי לעריכה` : `הוספת ${label}`}
        aria-label={label}
      >
        <Icon className="size-3.5 shrink-0" />
        <span>{label}</span>
        {showFilled && compact ? (
          <span
            aria-hidden
            className="absolute -end-0.5 -top-0.5 size-1.5 rounded-full bg-amber-500 ring-1 ring-white"
          />
        ) : null}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{dialogTitle}</h3>
            {loading ? (
              <p className="mt-3 text-sm text-zinc-500">טוען…</p>
            ) : (
              <textarea
                className="mt-3 min-h-[140px] w-full rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="הקלידי הערה חופשית…"
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                onClick={() => setOpen(false)}
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={saving || loading}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => void save()}
              >
                {saving ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
