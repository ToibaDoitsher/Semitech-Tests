"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import type { LookupEntitySlug } from "@/lib/lookups/entities";
import { ENTITY_LABELS } from "@/lib/lookups/entities";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_ROW_DELETE_CLASS,
  LIST_ROW_LINK_CLASS,
} from "@/components/ui/ListPage";
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
    <div className="space-y-8">
      <ListPageHeader
        title={title}
        subtitle="ערכים קבועים בלבד — ללא הקלדה חופשית במסכים אחרים"
        actions={
          <ExportExcelButton
            label="ייצוא לאקסל"
            filename={`לוקאפ-${entity}`}
            sheetName={title}
            exportUrl={`/api/export/lookups?entity=${encodeURIComponent(entity)}`}
          />
        }
      />

      <ListDataCard>
        <form
          onSubmit={addItem}
          className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-end sm:p-5 dark:border-slate-800"
        >
          <label className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">שם חדש</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-inner outline-none transition focus:border-blue-300 dark:border-zinc-600 dark:bg-zinc-900/40"
              placeholder="לדוגמה: יא3"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <Plus className="size-4 shrink-0" strokeWidth={2} />
            {saving ? "שומר…" : "הוספה"}
          </button>
        </form>
      </ListDataCard>

      <ListDataCard>
        <ListTableToolbar>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען…
            </span>
          ) : error ? (
            <span className="text-red-600">{(error as Error).message}</span>
          ) : (
            <span>{data?.items?.length ?? 0} רשומות</span>
          )}
        </ListTableToolbar>
        <ul>
          {data?.items?.map((item, idx) => (
            <li
              key={item.id}
              className={[
                "flex flex-col gap-2 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800",
                idx % 2 === 1 ? "bg-slate-50/50 dark:bg-zinc-800/25" : "",
              ].join(" ")}
            >
              {editingId === item.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:max-w-md dark:border-zinc-600 dark:bg-zinc-900/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      onClick={() => void saveEdit(item.id)}
                    >
                      שמירה
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-zinc-600"
                      onClick={() => setEditingId(null)}
                    >
                      ביטול
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-900 dark:text-zinc-100">{item.name}</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className={LIST_ROW_LINK_CLASS}
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                      }}
                    >
                      <Pencil className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                      עריכה
                    </button>
                    <button type="button" className={LIST_ROW_DELETE_CLASS} onClick={() => void removeItem(item.id)}>
                      <Trash2 className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
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
      </ListDataCard>
    </div>
  );
}
