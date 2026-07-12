"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  defaultTermForYear,
  parseTerm,
  type AcademicYearRow,
  type Term,
} from "@/lib/academicYears/types";

type Ctx = {
  years: AcademicYearRow[];
  activeYear: AcademicYearRow | null;
  viewingYear: AcademicYearRow | null;
  /** מחצית נצפית (א/ב) */
  viewingTerm: Term;
  readOnly: boolean;
  isLoading: boolean;
  error: Error | null;
  setViewingYearId: (id: string | null) => void;
  setViewingTerm: (term: Term) => void;
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
  const router = useRouter();
  const pathname = usePathname();
  const [viewId, setViewId] = useState<string | null>(initialViewYearId ?? null);
  const [termOverride, setTermOverride] = useState<Term | null>(null);

  useEffect(() => {
    const fromUrl = searchParams.get("academic_year_id");
    if (fromUrl) setViewId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const t = parseTerm(searchParams.get("term"));
    if (t) setTermOverride(t);
  }, [searchParams]);

  const viewingYear = viewId ? years.find((y) => y.id === viewId) ?? null : activeYear;
  const readOnly = Boolean(viewingYear && activeYear && viewingYear.id !== activeYear.id);

  const viewingTerm: Term =
    termOverride ?? defaultTermForYear(viewingYear ?? activeYear);

  const setViewingYearId = useCallback((id: string | null) => {
    setViewId(id);
    setTermOverride(null);
  }, []);

  const setViewingTerm = useCallback(
    (term: Term) => {
      setTermOverride(term);
      const params = new URLSearchParams(searchParams.toString());
      params.set("term", term);
      const yearId = viewId ?? activeYear?.id;
      if (yearId && viewId) {
        params.set("academic_year_id", yearId);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, viewId, activeYear?.id],
  );

  const value = useMemo(
    () => ({
      years,
      activeYear,
      viewingYear,
      viewingTerm,
      readOnly,
      isLoading,
      error: error ?? null,
      setViewingYearId,
      setViewingTerm,
      refresh: async () => {
        await mutate();
      },
    }),
    [
      years,
      activeYear,
      viewingYear,
      viewingTerm,
      readOnly,
      isLoading,
      error,
      setViewingYearId,
      setViewingTerm,
      mutate,
    ],
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

/** שנה + מחצית — לרשימות מבחנים/מעקב/השלמות */
export function withYearTermQuery(
  baseUrl: string,
  yearId: string | undefined | null,
  term: Term | undefined | null,
): string {
  let url = withYearQuery(baseUrl, yearId);
  if (!term) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}term=${encodeURIComponent(term)}`;
}
