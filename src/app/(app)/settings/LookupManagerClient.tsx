"use client";

import { useState } from "react";
import useSWR from "swr";
import type { LookupEntitySlug } from "@/lib/lookups/entities";
import { ENTITY_LABELS } from "@/lib/lookups/entities";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { TableClearFooter } from "@/components/ui/TableClearFooter";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type Item = { id: string; name: string };

export function LookupManagerClient({ entity }: { entity: LookupEntitySlug }) {
  const url = `/api/lookups/${entity}`;
  const { data, error, isLoading, mutate } = useSWR<{ items: Item[] }>(url, fetcher);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const title = ENTITY_LABELS[entity];
  const count = data?.items?.length ?? 0;

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setName("");
      await mutate();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    const n = editName.trim();
    if (!n) return;
    const r = await fetch(`${url}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "עדכון נכשל");
      return;
    }
    setEditingId(null);
    await mutate();
  }

  async function removeItem(id: string) {
    if (!confirm("למחוק? לא ניתן אם קיימות הפניות מתלמידות או שיבוצים.")) return;
    const r = await fetch(`${url}/${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-600">ערכים קבועים בלבד — ללא הקלדה חופשית במסכים אחרים</p>
        </div>
        <ExportExcelButton
          label="ייצוא לאקסל"
          filename={`לוקאפ-${entity}`}
          sheetName={title}
          exportUrl={`/api/export/lookups?entity=${encodeURIComponent(entity)}`}
        />
      </div>

      <form
        onSubmit={addItem}
        className="flex flex-col gap-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/40 p-5 shadow-sm sm:flex-row sm:items-end"
      >
        <label className="min-w-0 flex-1">
          <span className="text-sm font-medium text-zinc-700">שם חדש</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-violet-400"
            placeholder="לדוגמה: יא3"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:opacity-95 disabled:opacity-50"
        >
          {saving ? "שומר…" : "הוספה"}
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-md">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2.5 text-xs text-zinc-500">
          {isLoading ? (
            <>
              <Spinner className="size-4" />
              טוען…
            </>
          ) : error ? (
            <span className="text-red-700">{(error as Error).message}</span>
          ) : (
            <span>{data?.items?.length ?? 0} רשומות</span>
          )}
        </div>
        <ul className="divide-y divide-zinc-100">
          {data?.items?.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              {editingId === item.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm sm:max-w-md"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white"
                      onClick={() => void saveEdit(item.id)}
                    >
                      שמירה
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs"
                      onClick={() => setEditingId(null)}
                    >
                      ביטול
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium text-zinc-900">{item.name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-violet-700 hover:underline"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                      }}
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-700 hover:underline"
                      onClick={() => void removeItem(item.id)}
                    >
                      מחיקה
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <TableClearFooter
          label={title}
          count={count}
          apiPath={`/api/lookups/${entity}/clear-all`}
          confirmHint="אם יש תלמידות או שיבוצים שמפנים לערכים האלה, המחיקה עלולה להיכשל — יש לנקות קודם."
          onCleared={() => void mutate()}
        />
      </div>
    </div>
  );
}
