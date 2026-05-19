"use client";

import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { teacherDisplayName } from "@/lib/teachers/display";
import type { Teacher } from "@/lib/types/db";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאת חיפוש");
  return j as { teachers: Teacher[] };
};

type Props = {
  value: string;
  onChange: (teacherId: string, teacher: Teacher | null) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
};

export function TeacherSearchCombobox({
  value,
  onChange,
  disabled,
  required,
  label = "בחירת מורה",
  placeholder = "לחצי לבחירה או הקלידי לחיפוש…",
}: Props) {
  const { viewingYear } = useAcademicYear();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const deferred = useDeferredValue(query.trim());

  const searchUrl =
    open && !disabled
      ? withYearQuery(
          deferred
            ? `/api/teachers?q=${encodeURIComponent(deferred)}&limit=12`
            : "/api/teachers?limit=12",
          viewingYear?.id,
        )
      : null;

  const { data, isLoading } = useSWR(searchUrl, fetcher);

  const { data: selectedData } = useSWR(
    value ? `/api/teachers/${value}` : null,
    async (url) => {
      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return null;
      return (j as { teacher: Teacher }).teacher ?? null;
    },
  );

  useEffect(() => {
    if (selectedData) {
      setQuery(teacherDisplayName(selectedData));
    }
  }, [selectedData?.id]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const options = data?.teachers ?? [];

  function pick(t: Teacher) {
    onChange(t.id, t);
    setQuery(teacherDisplayName(t));
    setOpen(false);
  }

  function clear() {
    onChange("", null);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative block">
      <span className="text-sm font-medium text-zinc-700">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="relative mt-1">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          value={query}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 pe-9 text-sm outline-none focus:border-zinc-400 disabled:opacity-60"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (value) onChange("", null);
            setOpen(true);
          }}
        />
        {value ? (
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            className="absolute inset-y-0 end-1 px-2 text-xs text-zinc-500 hover:text-zinc-800"
            onClick={clear}
            aria-label="ניקוי"
          >
            ×
          </button>
        ) : null}
        {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 text-sm shadow-lg"
        >
          {isLoading ? (
            <li className="px-3 py-2 text-zinc-500">מחפש…</li>
          ) : options.length ? (
            options.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  className="w-full px-3 py-2 text-start hover:bg-zinc-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(t)}
                >
                  <span className="font-medium text-zinc-900">{teacherDisplayName(t)}</span>
                  {t.tz ? <span className="ms-2 text-zinc-500">ת״ז {t.tz}</span> : null}
                  {t.email ? <span className="block text-xs text-zinc-500">{t.email}</span> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-zinc-500">
              {deferred ? "לא נמצאו מורות" : "אין מורות ברשימה"}
            </li>
          )}
        </ul>
        ) : null}
      </div>
    </div>
  );
}
