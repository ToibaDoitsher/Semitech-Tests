"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { AcademicYearRow } from "@/lib/academicYears/types";

type Ctx = {
  years: AcademicYearRow[];
  activeYear: AcademicYearRow | null;
  viewingYear: AcademicYearRow | null;
  readOnly: boolean;
  isLoading: boolean;
  error: Error | null;
  setViewingYearId: (id: string | null) => void;
  refresh: () => Promise<void>;
};

const AcademicYearContext = createContext<Ctx | null>(null);

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאת טעינת שנות לימוד");
  return j as { years: AcademicYearRow[] };
};

export function AcademicYearProvider({
  children,
  initialViewYearId,
}: {
  children: React.ReactNode;
  initialViewYearId?: string | null;
}) {
  const { data, error, isLoading, mutate } = useSWR("/api/academic-years", fetcher);
  const years = data?.years ?? [];
  const activeYear = years.find((y) => y.is_active) ?? null;

  const searchParams = useSearchParams();
  const [viewId, setViewId] = useState<string | null>(initialViewYearId ?? null);

  useEffect(() => {
    const fromUrl = searchParams.get("academic_year_id");
    if (fromUrl) setViewId(fromUrl);
  }, [searchParams]);

  const viewingYear = viewId ? years.find((y) => y.id === viewId) ?? null : activeYear;
  const readOnly = Boolean(viewingYear && activeYear && viewingYear.id !== activeYear.id);

  const setViewingYearId = useCallback((id: string | null) => {
    setViewId(id);
  }, []);

  const value = useMemo(
    () => ({
      years,
      activeYear,
      viewingYear,
      readOnly,
      isLoading,
      error: error ?? null,
      setViewingYearId,
      refresh: async () => {
        await mutate();
      },
    }),
    [years, activeYear, viewingYear, readOnly, isLoading, error, setViewingYearId, mutate],
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) throw new Error("useAcademicYear must be used within AcademicYearProvider");
  return ctx;
}

export function withYearQuery(baseUrl: string, yearId: string | undefined | null): string {
  if (!yearId) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}academic_year_id=${encodeURIComponent(yearId)}`;
}
