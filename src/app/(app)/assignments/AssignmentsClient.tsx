"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { pickLookupName } from "@/lib/lookups/display";
import type { ExamTargetType, Teacher } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type AssignmentRow = {
  id: string;
  teacher_id: string;
  subject: string;
  grade_level_id: string;
  target_type: ExamTargetType;
  target_id: string;
  active: boolean;
  target_label?: string;
  target_type_label?: string;
  teachers: { name: string } | null;
  grade_levels: unknown;
};

type LookupItem = { id: string; name: string };

const targetStepOptions: { value: ExamTargetType; label: string }[] = [
  { value: "class", label: "כיתה" },
  { value: "specialization", label: "התמחות" },
  { value: "track", label: "מסלול" },
];

export function AssignmentsClient() {
  const { data: tData, error: tErr, isLoading: tLoad } = useSWR<{ teachers: Teacher[] }>("/api/teachers", fetcher);
  const { data: aData, error: aErr, isLoading: aLoad, mutate } = useSWR<{ assignments: AssignmentRow[] }>(
    "/api/teacher-assignments",
    fetcher,
  );
  const { data: glData } = useSWR<{ items: LookupItem[] }>("/api/lookups/grade-levels", fetcher);
  const { data: clData } = useSWR<{ items: LookupItem[] }>("/api/lookups/classes", fetcher);
  const { data: spData } = useSWR<{ items: LookupItem[] }>("/api/lookups/specializations", fetcher);
  const { data: trData } = useSWR<{ items: LookupItem[] }>("/api/lookups/tracks", fetcher);

  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevelId, setGradeLevelId] = useState("");
  const [targetKind, setTargetKind] = useState<ExamTargetType>("class");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const targetItems = useMemo(() => {
    if (targetKind === "class") return clData?.items ?? [];
    if (targetKind === "specialization") return spData?.items ?? [];
    return trData?.items ?? [];
  }, [targetKind, clData, spData, trData]);

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId) return alert("בחרי מורה");
    if (!gradeLevelId) return alert("בחרי שכבה");
    if (!targetId) return alert("בחרי יעד לשיבוץ");
    setSaving(true);
    try {
      const r = await fetch("/api/teacher-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          subject,
          grade_level_id: gradeLevelId,
          target_type: targetKind,
          target_id: targetId,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setSubject("");
      setGradeLevelId("");
      setTargetId("");
      await mutate();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: AssignmentRow, active: boolean) {
    const r = await fetch(`/api/teacher-assignments/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "עדכון נכשל");
      return;
    }
    await mutate();
  }

  async function removeRow(id: string) {
    if (!confirm("למחוק שיבוץ?")) return;
    const r = await fetch(`/api/teacher-assignments/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  const gradeLevels = glData?.items ?? [];
  const rows = aData?.assignments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">שיבוצי מורות</h1>
          <p className="mt-1 text-sm text-zinc-600">טבלת כל השיבוצים · יעד אחד בלבד לכל שיבוץ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportExcelButton
            label="ייצוא לאקסל"
            filename="שיבוצי-מורות"
            sheetName="שיבוצים"
            exportUrl="/api/export/assignments"
          />
          <Link href="/settings/grade-levels" className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline">
            ניהול לוקאפים
          </Link>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-zinc-900">הוספת שיבוץ</h2>
        <p className="mt-1 text-sm text-zinc-600">שלב 1: סוג יעד · שלב 2: בחירת ערך מהרשימה</p>
      </div>

      <form
        onSubmit={addAssignment}
        className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 md:grid-cols-2 lg:grid-cols-3"
      >
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">מורה *</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">— בחרי —</option>
            {tData?.teachers?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {tLoad ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="size-4" />
              טוען מורות…
            </div>
          ) : tErr ? (
            <p className="mt-1 text-xs text-red-700">{(tErr as Error).message}</p>
          ) : null}
        </label>

        <label className="block md:col-span-1">
          <span className="text-sm font-medium text-zinc-700">מקצוע *</span>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="מתמטיקה…"
          />
        </label>

        <LookupSelect
          label="שכבה *"
          value={gradeLevelId}
          onChange={setGradeLevelId}
          items={gradeLevels}
          required
        />

        <fieldset className="md:col-span-2 lg:col-span-3">
          <legend className="text-sm font-medium text-zinc-700">שלב 1 — סוג שיבוץ (אחד בלבד)</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {targetStepOptions.map((o) => (
              <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="targetKind"
                  value={o.value}
                  checked={targetKind === o.value}
                  onChange={() => {
                    setTargetKind(o.value);
                    setTargetId("");
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block md:col-span-2 lg:col-span-3">
          <span className="text-sm font-medium text-zinc-700">שלב 2 — ערך יעד *</span>
          <select
            required
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
          >
            <option value="">— בחרי —</option>
            {targetItems.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end md:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "שומר…" : "הוספת שיבוץ"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          {aLoad ? (
            <>
              <Spinner className="size-4" />
              טוען שיבוצים…
            </>
          ) : aErr ? (
            <span className="text-red-700">{(aErr as Error).message}</span>
          ) : (
            <span>{rows.length} שיבוצים</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-zinc-50 text-right text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">מורה</th>
                <th className="px-4 py-3 font-medium">מקצוע</th>
                <th className="px-4 py-3 font-medium">סוג שיבוץ</th>
                <th className="px-4 py-3 font-medium">ערך שיבוץ</th>
                <th className="px-4 py-3 font-medium">שכבה</th>
                <th className="px-4 py-3 font-medium">פעיל</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.length ? (
                rows.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-medium">{a.teachers?.name ?? "—"}</td>
                    <td className="px-4 py-3">{a.subject}</td>
                    <td className="px-4 py-3 text-zinc-700">{a.target_type_label ?? a.target_type}</td>
                    <td className="px-4 py-3 text-zinc-800">{a.target_label ?? a.target_id}</td>
                    <td className="px-4 py-3">{pickLookupName(a.grade_levels)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                          a.active ? "border-zinc-300 bg-white" : "border-zinc-200 bg-zinc-100 text-zinc-600"
                        }`}
                        onClick={() => void toggleActive(a, !a.active)}
                      >
                        {a.active ? "פעיל" : "כבוי"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:underline"
                        onClick={() => void removeRow(a.id)}
                      >
                        מחיקה
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10 text-center text-zinc-500" colSpan={7}>
                    {aLoad ? "טוען…" : "אין שיבוצים"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TableClearFooter
          label="שיבוצי מורות"
          count={rows.length}
          apiPath="/api/teacher-assignments/clear-all"
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}

function LookupSelect({
  label,
  value,
  onChange,
  items,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: LookupItem[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
      >
        <option value="">— בחרי —</option>
        {items.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
