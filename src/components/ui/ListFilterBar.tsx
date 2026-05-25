"use client";

import { Search, X } from "lucide-react";
import type { ChangeEvent } from "react";

export type FilterSelectOption = {
  value: string;
  label: string;
};

export type FilterSelectField = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  allLabel?: string;
};

type ListFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  searchHint?: string;
  filters: FilterSelectField[];
  onClearAll?: () => void;
  isAnyActive?: boolean;
};

const controlClass =
  "mt-1.5 w-full rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-500/25 dark:border-zinc-600 dark:bg-zinc-950/40 dark:focus:ring-blue-400/20";

export function ListFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "חיפוש…",
  searchLabel = "חיפוש",
  searchHint,
  filters,
  onClearAll,
  isAnyActive = false,
}: ListFilterBarProps) {
  const showClear = isAnyActive && onClearAll;
  const filterCount = filters.length;
  const gridColsClass =
    filterCount <= 2
      ? "lg:grid-cols-4"
      : filterCount <= 4
        ? "lg:grid-cols-4 xl:grid-cols-6"
        : "lg:grid-cols-4 xl:grid-cols-7";

  return (
    <div className="bg-gradient-to-bl from-slate-50/95 via-white to-sky-50/35 p-5 sm:p-6 dark:from-slate-900/50 dark:via-zinc-900/35 dark:to-slate-900/25">
      <div className="mb-4 flex flex-col gap-2 border-b border-slate-200/60 pb-4 dark:border-slate-700/50 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">סינון וחיפוש</p>
        {showClear ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 self-start text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline dark:text-blue-300"
            onClick={onClearAll}
          >
            <X className="size-3.5" strokeWidth={2} />
            ניקוי סינון
          </button>
        ) : null}
      </div>
      <div className={`grid gap-4 sm:grid-cols-2 ${gridColsClass}`}>
        <label className="block sm:col-span-2 xl:col-span-2">
          <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">{searchLabel}</span>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-zinc-500"
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              value={searchValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={`${controlClass} mt-0 pe-10`}
              dir="rtl"
            />
          </div>
          {searchHint ? (
            <span className="mt-1 block text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
              {searchHint}
            </span>
          ) : null}
        </label>

        {filters.map((f) => (
          <label key={f.id} className="block">
            <span className="block text-xs font-semibold text-slate-600 dark:text-zinc-400">{f.label}</span>
            <select
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className={controlClass}
            >
              <option value="">{f.allLabel ?? "הכל"}</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

/** מנרמל מחרוזת לחיפוש — לוואסה־סנס וגם נוקה רווחים כפולים */
export function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * בודק אם החיפוש (שני שמות מופרדים ברווח, גם בסדר הפוך) תואם לשני שדות
 * כמו "first last" או "last first" וגם חיפוש מילה אחת.
 */
export function matchesNameQuery(
  query: string,
  parts: (string | null | undefined)[],
): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const fields = parts.map((p) => normalizeSearchText(p ?? ""));
  const haystack = fields.filter(Boolean).join(" ");
  if (haystack.includes(q)) return true;
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length <= 1) return false;
  return tokens.every((t) => haystack.includes(t));
}
