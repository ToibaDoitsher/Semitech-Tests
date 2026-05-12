"use client";

import { useState } from "react";
import { ConfirmDangerDialog } from "@/components/ui/ConfirmDangerDialog";

const CONFIRM_PHRASE = "מחק הכל";

type Props = {
  /** תיאור לטבלה (למשל "שיבוצי מורות") */
  label: string;
  count: number;
  /** POST endpoint שמוחק את כל הרשומות (או השתמשו ב־localClear במקום) */
  apiPath?: string;
  /** מחיקה מקומית בלי שרת — למשל איפוס תצוגה מקדימה */
  localClear?: () => void | Promise<void>;
  onCleared: () => void;
  /** טקסט נוסף בחלון האישור (אזהרות) */
  confirmHint?: string;
};

export function TableClearFooter({ label, count, apiPath, localClear, onCleared, confirmHint }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
      alert(typeof n === "number" ? `נמחקו ${n} רשומות.` : "המחיקה הושלמה.");
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
        description={`פעולה בלתי הפיכה: יימחקו ${count} רשומות מתוך «${label}».`}
        hint={confirmHint}
        requiredPhrase={CONFIRM_PHRASE}
        confirmLabel="כן, מחק לצמיתות"
        cancelLabel="ביטול"
        busy={busy}
        onConfirm={() => runDelete()}
      />
    </div>
  );
}
