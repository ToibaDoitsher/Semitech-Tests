"use client";

import { useEffect, useState } from "react";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";

const CONFIRM_PHRASE = "מחק הכל";

type Props = {
  label: string;
  count: number;
  apiPath?: string;
  localClear?: () => void | Promise<void>;
  onCleared: () => void;
  confirmHint?: string;
  /** טוען תצוגה מקדימה (למשל מחיקה לפי זוג מחזורים) */
  scopePreviewPath?: string;
};

type ScopePreview = {
  students: number;
  exams: number;
  assignments: number;
  makeups: number;
};

export function TableClearFooter({
  label,
  count,
  apiPath,
  localClear,
  onCleared,
  confirmHint,
  scopePreviewPath,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scopePreview, setScopePreview] = useState<ScopePreview | null>(null);

  useEffect(() => {
    if (!open || !scopePreviewPath) {
      setScopePreview(null);
      return;
    }
    void (async () => {
      try {
        const r = await fetch(scopePreviewPath);
        const j = await r.json();
        if (r.ok) setScopePreview((j as { preview: ScopePreview }).preview ?? null);
      } catch {
        setScopePreview(null);
      }
    })();
  }, [open, scopePreviewPath]);

  const scopeHint = scopePreview
    ? [
        `בזוג המחזורים הנבחר יימחקו:`,
        scopePreview.students ? `• ${scopePreview.students} תלמידות` : null,
        scopePreview.exams ? `• ${scopePreview.exams} מבחנים` : null,
        scopePreview.assignments ? `• ${scopePreview.assignments} שיבוצים` : null,
        scopePreview.makeups ? `• ${scopePreview.makeups} השלמות` : null,
        `ובמסך זה: ${count} רשומות מ«${label}».`,
      ]
        .filter(Boolean)
        .join("\n")
    : null;

  async function runDelete() {
    if (count === 0) return;
    if (!apiPath && !localClear) return;
    setBusy(true);
    try {
      if (localClear) {
        await localClear();
        alert("בוצע.");
        onCleared();
        setOpen(false);
        return;
      }
      const r = await fetch(apiPath!, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert((j as { error?: string }).error ?? "שגיאה במחיקה");
        return;
      }
      const n = (j as { deleted?: number }).deleted;
      alert(typeof n === "number" ? `נמחקו ${n} רשומות (מחיקה רכה).` : "המחיקה הושלמה.");
      onCleared();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-[var(--border)] bg-slate-50/80 px-4 py-3 text-center dark:bg-zinc-900/40">
      <button
        type="button"
        disabled={count === 0}
        onClick={() => setOpen(true)}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 underline decoration-slate-300/80 underline-offset-2 transition hover:bg-red-50 hover:text-red-700 hover:decoration-red-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline disabled:hover:bg-transparent dark:text-zinc-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
      >
        מחיקת כל הרשומות — {label}
      </button>

      <ConfirmDangerDialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="האם את בטוחה?"
        description={`פעולה בלתי הפיכה: יימחקו ${count} רשומות מתוך «${label}» (מחיקה רכה).`}
        hint={scopeHint ?? confirmHint}
        requiredPhrase={CONFIRM_PHRASE}
        confirmLabel="כן, מחק"
        cancelLabel="ביטול"
        busy={busy}
        onConfirm={() => runDelete()}
      />
    </div>
  );
}
