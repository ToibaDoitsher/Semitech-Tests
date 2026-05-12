"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Row = {
  id: string;
  exam_id: string;
  submitted_exam: string | null;
  approved_by_coordinator: boolean;
  sent_for_review: boolean;
  grades_submitted: boolean;
  grades_approved: boolean;
  transferred_to_system: boolean;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TrackingClient() {
  const { data, error, isLoading, mutate } = useSWR<{ tracking: Row[] }>("/api/tracking", fetcher);
  const [editingId, setEditingId] = useState<string | null>(null);
  const count = data?.tracking?.length ?? 0;

  async function saveRow(
    id: string,
    payload: {
      submitted_exam: string | null;
      approved_by_coordinator: boolean;
      sent_for_review: boolean;
      grades_submitted: boolean;
      grades_approved: boolean;
      transferred_to_system: boolean;
    },
  ) {
    const r = await fetch(`/api/tracking/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "עדכון נכשל");
      return;
    }
    setEditingId(null);
    await mutate();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">מעקב מבחנים</h1>
          <p className="mt-1 text-sm text-zinc-600">עריכה בשורה: פתיחה, שינוי שדות ושמירה מפורשת</p>
        </div>
        <ExportExcelButton
          label="ייצוא לאקסל"
          filename="מעקב-מבחנים"
          sheetName="מעקב"
          exportUrl="/api/export/tracking"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        {isLoading ? (
          <>
            <Spinner className="size-4" />
            טוען…
          </>
        ) : error ? (
          <span className="text-red-700">{(error as Error).message}</span>
        ) : (
          <span>{data?.tracking?.length ?? 0} שורות</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-[960px] w-full text-xs">
          <thead className="bg-zinc-50 text-right text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">מורה</th>
              <th className="px-3 py-2 font-medium">מקצוע</th>
              <th className="px-3 py-2 font-medium">תאריך</th>
              <th className="px-3 py-2 font-medium">מבחן</th>
              <th className="px-3 py-2 font-medium">עריכה</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data?.tracking?.length ? (
              data.tracking.map((row) => (
                <tr key={row.id} className="align-top hover:bg-zinc-50/80">
                  <td className="px-3 py-2 font-medium">{row.exam?.teacher_name ?? "—"}</td>
                  <td className="px-3 py-2">{row.exam?.subject ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.exam?.exam_date ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/exams/${row.exam_id}`} className="text-zinc-900 underline-offset-2 hover:underline">
                      פתיחת מבחן
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {editingId === row.id ? (
                      <TrackingRowForm
                        row={row}
                        onCancel={() => setEditingId(null)}
                        onSave={(payload) => void saveRow(row.id, payload)}
                      />
                    ) : (
                      <button
                        type="button"
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-50"
                        onClick={() => setEditingId(row.id)}
                      >
                        עריכה
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={5}>
                  {isLoading ? "טוען…" : "אין נתוני מעקב"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TableClearFooter
          label="שורות מעקב"
          count={count}
          apiPath="/api/tracking/clear-all"
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}

function TrackingRowForm({
  row,
  onCancel,
  onSave,
}: {
  row: Row;
  onCancel: () => void;
  onSave: (p: {
    submitted_exam: string | null;
    approved_by_coordinator: boolean;
    sent_for_review: boolean;
    grades_submitted: boolean;
    grades_approved: boolean;
    transferred_to_system: boolean;
  }) => void;
}) {
  const [submittedLocal, setSubmittedLocal] = useState(toLocalInput(row.submitted_exam));
  const [approved, setApproved] = useState(row.approved_by_coordinator);
  const [sent, setSent] = useState(row.sent_for_review);
  const [gradesIn, setGradesIn] = useState(row.grades_submitted);
  const [gradesOk, setGradesOk] = useState(row.grades_approved);
  const [transferred, setTransferred] = useState(row.transferred_to_system);

  return (
    <div className="flex min-w-[280px] flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
      <label className="block text-[11px] text-zinc-700">
        הוגש מבחן
        <input
          type="datetime-local"
          value={submittedLocal}
          onChange={(e) => setSubmittedLocal(e.target.value)}
          className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-1 py-1"
        />
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
        אישור רכזת
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} />
        נשלח לבדיקה
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={gradesIn} onChange={(e) => setGradesIn(e.target.checked)} />
        ציונים הוגשו
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={gradesOk} onChange={(e) => setGradesOk(e.target.checked)} />
        ציונים אושרו
      </label>
      <label className="inline-flex items-center gap-2 text-[11px]">
        <input type="checkbox" checked={transferred} onChange={(e) => setTransferred(e.target.checked)} />
        הועבר למערכת
      </label>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-900 bg-zinc-900 px-2 py-1 text-[11px] text-white"
          onClick={() => {
            const iso = submittedLocal ? new Date(submittedLocal).toISOString() : null;
            onSave({
              submitted_exam: iso,
              approved_by_coordinator: approved,
              sent_for_review: sent,
              grades_submitted: gradesIn,
              grades_approved: gradesOk,
              transferred_to_system: transferred,
            });
          }}
        >
          שמירה
        </button>
        <button type="button" className="rounded-md border border-zinc-300 px-2 py-1 text-[11px]" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </div>
  );
}
