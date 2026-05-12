"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { downloadExcelFromRows } from "@/lib/export/downloadExcelClient";

type PropsApi = {
  label: string;
  filename: string;
  sheetName?: string;
  /** GET — תשובה: { rows: רשומות לאקסל } */
  exportUrl: string;
};

type PropsFn = {
  label: string;
  filename: string;
  sheetName?: string;
  getRows: () => Promise<Record<string, string | number | boolean | null | undefined>[]>;
};

type Props = PropsApi | PropsFn;

export function ExportExcelButton(props: Props) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      let rows: Record<string, string | number | boolean | null | undefined>[];
      if ("exportUrl" in props) {
        const r = await fetch(props.exportUrl);
        const j = (await r.json().catch(() => ({}))) as { rows?: unknown; error?: string };
        if (!r.ok) throw new Error(j.error ?? "שגיאת ייצוא");
        if (!Array.isArray(j.rows)) throw new Error("תשובת שרת לא תקינה");
        rows = j.rows as Record<string, string | number | boolean | null | undefined>[];
      } else {
        rows = await props.getRows();
      }
      await downloadExcelFromRows(props.filename, props.sheetName ?? "נתונים", rows);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void run()}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[var(--color-primary)]/35 hover:bg-sky-50/80 hover:text-[var(--color-primary)] active:scale-[0.98] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:border-blue-400/40 dark:hover:bg-zinc-800/60 dark:hover:text-blue-200"
    >
      <Download className="size-4 shrink-0 text-[var(--color-primary)] opacity-90 dark:text-blue-300" strokeWidth={1.75} />
      {busy ? "מייצא…" : props.label}
    </button>
  );
}
