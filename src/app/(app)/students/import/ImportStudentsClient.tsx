"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

type PreviewRow = {
  rowNumber: number;
  first_name: string;
  last_name: string;
  tz: string;
  grade_level: string;
  class_name: string;
  specialization: string;
  track: string;
  errors: string[];
  warnings?: string[];
};

export function ImportStudentsClient() {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setMessage(null);
    setBusy(true);
    setRows(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/students/import/preview", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setRows((j as { rows: PreviewRow[] }).rows ?? []);
      setValidCount((j as { validCount: number }).validCount ?? 0);
      setErrorCount((j as { errorCount: number }).errorCount ?? 0);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  async function commit() {
    if (!rows?.length || errorCount > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const payload = rows.map((r) => ({
        rowNumber: r.rowNumber,
        first_name: r.first_name,
        last_name: r.last_name,
        tz: r.tz,
        grade_level: r.grade_level,
        class_name: r.class_name,
        specialization: r.specialization,
        track: r.track,
      }));
      const r = await fetch("/api/students/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, updateExisting }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      const ins = (j as { inserted?: number }).inserted ?? 0;
      const upd = (j as { updated?: number }).updated ?? 0;
      const sk = (j as { skipped?: number }).skipped ?? 0;
      setMessage(`ייבוא הושלם: נוספו ${ins}, עודכנו ${upd}, דולגו ${sk}`);
      setRows(null);
      setValidCount(0);
      setErrorCount(0);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">ייבוא תלמידות מאקסל</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            כותרות בעברית (או באנגלית) — הערכים בשורות חייבים להתאים בדיוק לשמות בלוקאפים (הגדרות).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/students/import/template"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
          >
            הורדת תבנית Excel
          </a>
          <Link href="/students" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50">
            חזרה לרשימה
          </Link>
        </div>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center text-sm text-zinc-600 hover:border-zinc-400">
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="size-5" />
            מעבד…
          </span>
        ) : (
          <>
            <span className="font-medium text-zinc-800">גרירה ושחרור או לחיצה לבחירת קובץ .xlsx</span>
            <span className="text-xs text-[var(--muted)]">
              שם פרטי · שם משפחה · תעודת זהות · שכבה · כיתה · התמחות · מסלול
            </span>
          </>
        )}
      </label>

      {message ? <p className="text-sm text-zinc-800">{message}</p> : null}

      {rows ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="text-emerald-800">שורות תקינות: {validCount}</span>
            <span className="text-red-800">שורות שגויות: {errorCount}</span>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
              עדכן תלמידות קיימות (לפי ת״ז)
            </label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-[900px] w-full text-xs">
              <thead className="bg-zinc-50 text-right text-zinc-600">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">שם פרטי</th>
                  <th className="px-2 py-2">שם משפחה</th>
                  <th className="px-2 py-2">תעודת זהות</th>
                  <th className="px-2 py-2">שכבה</th>
                  <th className="px-2 py-2">כיתה</th>
                  <th className="px-2 py-2">התמחות</th>
                  <th className="px-2 py-2">מסלול</th>
                  <th className="px-2 py-2">הערות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r, i) => (
                  <tr key={`${r.rowNumber}-${i}-${r.tz}`} className={r.errors.length ? "bg-red-50" : ""}>
                    <td className="px-2 py-2 font-mono">{r.rowNumber}</td>
                    <td className="px-2 py-2">{r.first_name}</td>
                    <td className="px-2 py-2">{r.last_name}</td>
                    <td className="px-2 py-2 font-mono" dir="ltr">
                      {r.tz}
                    </td>
                    <td className="px-2 py-2">{r.grade_level}</td>
                    <td className="px-2 py-2">{r.class_name}</td>
                    <td className="px-2 py-2">{r.specialization}</td>
                    <td className="px-2 py-2">{r.track}</td>
                    <td className="px-2 py-2 text-red-800">
                      {r.errors.length ? r.errors.map((e) => <div key={e}>שורה {r.rowNumber}: {e}</div>) : null}
                      {r.warnings?.length
                        ? r.warnings.map((w) => (
                            <div key={w} className="text-amber-800">
                              {w}
                            </div>
                          ))
                        : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TableClearFooter
              label="תצוגה מקדימה"
              count={rows.length}
              localClear={() => {
                setRows(null);
                setValidCount(0);
                setErrorCount(0);
                setMessage(null);
              }}
              confirmHint="רק התצוגה המקדימה — לא נמחקות תלמידות מהמסד."
              onCleared={() => {}}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <ExportExcelButton
              label="תצוגה מקדימה לאקסל"
              filename="ייבוא-תצוגה-מקדימה"
              sheetName="ייבוא"
              getRows={async () =>
                (rows ?? []).map((r) => ({
                  מספר_שורה: r.rowNumber,
                  שם_פרטי: r.first_name,
                  שם_משפחה: r.last_name,
                  תעודת_זהות: r.tz,
                  שכבה: r.grade_level,
                  כיתה: r.class_name,
                  התמחות: r.specialization,
                  מסלול: r.track,
                  שגיאות: r.errors.join("; "),
                  אזהרות: (r.warnings ?? []).join("; "),
                }))
              }
            />
            <button
              type="button"
              disabled={busy || errorCount > 0}
              onClick={() => void commit()}
              className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              אישור ייבוא
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setRows(null);
                setValidCount(0);
                setErrorCount(0);
                setMessage(null);
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
