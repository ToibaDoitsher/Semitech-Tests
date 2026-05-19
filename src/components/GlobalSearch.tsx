"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";

type Result = { type: string; id: string; label: string; href: string };

export function GlobalSearch() {
  const { viewingYear } = useAcademicYear();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    if (timer.current) clearTimeout(timer.current);

    const trimmed = q.trim();
    const delay = trimmed.length >= 2 ? 250 : 0;

    timer.current = setTimeout(() => {
      setLoading(true);
      const path =
        trimmed.length >= 2
          ? `/api/search?q=${encodeURIComponent(trimmed)}`
          : "/api/search";
      const url = withYearQuery(path, viewingYear?.id);

      void fetch(url)
        .then((r) => r.json())
        .then((j) => {
          setResults((j as { results?: Result[] }).results ?? []);
          setActiveIdx(-1);
        })
        .catch(() => {
          setResults([]);
          setActiveIdx(-1);
        })
        .finally(() => setLoading(false));
    }, delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, open, viewingYear?.id]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !results.length) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      window.location.href = results[activeIdx].href;
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  const showPanel = open && (loading || results.length > 0);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        ref={inputRef}
        type="search"
        placeholder="חיפוש תלמידות, מורות, מבחנים…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-zinc-200 bg-white py-2 pe-3 ps-9 text-sm outline-none focus:border-sky-400 dark:border-zinc-600 dark:bg-zinc-900"
      />
      {showPanel ? (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {loading ? (
            <li className="px-3 py-2 text-sm text-zinc-500">טוען…</li>
          ) : (
            results.map((r, idx) => (
              <li key={`${r.type}-${r.id}`}>
                <Link
                  href={r.href}
                  className={`block px-3 py-2 text-sm ${
                    idx === activeIdx
                      ? "bg-sky-50 dark:bg-sky-950/40"
                      : "hover:bg-zinc-50 dark:hover:bg-white/5"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <span className="text-xs text-zinc-500">{r.type}</span>
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{r.label}</div>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
