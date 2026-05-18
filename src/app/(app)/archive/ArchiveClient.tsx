"use client";

import { useRouter } from "next/navigation";
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

export function ArchiveClient() {
  const router = useRouter();
  const { activeYear, setViewingYearId } = useAcademicYear();
  const { data, error, isLoading } = useSWR("/api/academic-years", fetcher);

  const archived = (data?.years ?? []).filter((y) => !y.is_active);

  function openYear(id: string) {
    setViewingYearId(id);
    router.push(`/?academic_year_id=${encodeURIComponent(id)}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="ארכיון שנים"
        subtitle="צפייה בלבד בנתוני שנים קודמות. לעריכה — הפעילי שנה כפעילה בהגדרות."
      />

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <p className="text-red-600">{(error as Error).message}</p>
      ) : archived.length ? (
        <ul className="divide-y rounded-xl border bg-white dark:bg-zinc-900/40">
          {archived.map((y) => (
            <li key={y.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-medium">{y.year_name}</span>
              <button
                type="button"
                onClick={() => openYear(y.id)}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
              >
                צפייה בארכיון
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600">אין שנים בארכיון. השנה הפעילה: {activeYear?.year_name ?? "—"}</p>
      )}
    </div>
  );
}
