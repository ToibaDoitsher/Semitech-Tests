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
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm font-medium text-emerald-900 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
    >
      <Download className="size-4 shrink-0" strokeWidth={1.75} />
      {busy ? "מייצא…" : props.label}
    </button>
  );
}
