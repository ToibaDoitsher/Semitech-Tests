"use client";

import { useState } from "react";
import useSWR from "swr";
import { useAcademicYear } from "@/components/academicYears/AcademicYearProvider";
import { ListPageHeader } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import type { AcademicYearRow } from "@/lib/academicYears/types";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
  return j as { years: AcademicYearRow[] };
};

export function AcademicYearsClient() {
  const { refresh } = useAcademicYear();
  const { data, error, isLoading, mutate } = useSWR("/api/academic-years", fetcher);
  const [yearName, setYearName] = useState("");
  const [setActive, setSetActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const years = data?.years ?? [];

  async function createYear(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year_name: yearName, set_active: setActive }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setYearName("");
      await mutate();
      await refresh();
      setMsg("שנה נוצרה בהצלחה");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function activate(id: string) {
    setMsg(null);
    const r = await fetch("/api/academic-years", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active_year_id: id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg((j as { error?: string }).error ?? "שגיאה");
      return;
    }
    await mutate();
    await refresh();
    setMsg("השנה הפעילה עודכנה");
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="שנות לימוד"
        subtitle="כל הנתונים במערכת שייכים לשנה אחת. רק שנה אחת פעילה בכל זמן."
      />

      <form onSubmit={createYear} className="rounded-2xl border bg-white p-6 dark:bg-zinc-900/40">
        <h2 className="text-lg font-semibold">שנה חדשה</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            <span className="font-medium">שם שנה (למשל 2027)</span>
            <input
              required
              value={yearName}
              onChange={(e) => setYearName(e.target.value)}
              className="mt-1 block w-48 rounded-lg border px-3 py-2"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={setActive} onChange={(e) => setSetActive(e.target.checked)} />
            הפוך לשנה פעילה
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? "יוצר…" : "צור שנה"}
          </button>
        </div>
        {msg ? <p className="mt-3 text-sm text-zinc-600">{msg}</p> : null}
      </form>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-600">{(error as Error).message}</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-white dark:bg-zinc-900/40">
          {years.map((y) => (
            <li key={y.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">
                {y.year_name}
                {y.is_active ? (
                  <span className="ms-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">פעילה</span>
                ) : null}
              </span>
              {!y.is_active ? (
                <button
                  type="button"
                  onClick={() => void activate(y.id)}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  הפוך לפעילה
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
