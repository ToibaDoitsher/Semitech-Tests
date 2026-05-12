"use client";

import Link from "next/link";
import { Settings2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_ROW_DELETE_CLASS,
} from "@/components/ui/ListPage";
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
    <div className="space-y-8">
      <ListPageHeader
        title="שיבוצי מורות"
        subtitle="טבלת כל השיבוצים · יעד אחד בלבד לכל שיבוץ"
        actions={
          <>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="שיבוצי-מורות"
              sheetName="שיבוצים"
              exportUrl="/api/export/assignments"
            />
            <Link href="/settings/grade-levels" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200">
              <Settings2 className="size-4 shrink-0 opacity-80" strokeWidth={2} />
              ניהול לוקאפים
            </Link>
          </>
        }
      />

      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">הוספת שיבוץ</h2>
        <p className="mt-1 text-base font-light text-slate-500 dark:text-zinc-400">שלב 1: סוג יעד · שלב 2: בחירת ערך מהרשימה</p>
      </div>

      <form
        onSubmit={addAssignment}
        className="grid gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-3 dark:border-slate-700/70 dark:bg-zinc-900/50"
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
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {saving ? "שומר…" : "הוספת שיבוץ"}
          </button>
        </div>
      </form>

      <ListDataCard>
        <ListTableToolbar>
          {aLoad ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען שיבוצים…
            </span>
          ) : aErr ? (
            <span className="text-red-600">{(aErr as Error).message}</span>
          ) : (
            <span>{rows.length} שיבוצים</span>
          )}
        </ListTableToolbar>
        <div className="overflow-x-auto">
          <table className="app-table min-w-[720px]">
            <thead>
              <tr>
                <th>מורה</th>
                <th>מקצוע</th>
                <th>סוג שיבוץ</th>
                <th>ערך שיבוץ</th>
                <th>שכבה</th>
                <th>פעיל</th>
                <th className="w-[1%] whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium text-slate-900 dark:text-zinc-100">{a.teachers?.name ?? "—"}</td>
                    <td>{a.subject}</td>
                    <td className="text-slate-600 dark:text-zinc-300">{a.target_type_label ?? a.target_type}</td>
                    <td className="text-slate-800 dark:text-zinc-200">{a.target_label ?? a.target_id}</td>
                    <td>{pickLookupName(a.grade_levels)}</td>
                    <td>
                      <button
                        type="button"
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                          a.active
                            ? "border-slate-200 bg-white shadow-sm hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/40"
                            : "border-slate-100 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800/50"
                        }`}
                        onClick={() => void toggleActive(a, !a.active)}
                      >
                        {a.active ? "פעיל" : "כבוי"}
                      </button>
                    </td>
                    <td>
                      <button type="button" className={LIST_ROW_DELETE_CLASS} onClick={() => void removeRow(a.id)}>
                        <Trash2 className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
                        מחיקה
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={7}>
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
      </ListDataCard>
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
