"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PairOption = {
  cohortAId: string;
  cohortBId: string;
  label: string;
  isActivePair: boolean;
};

type PairResponse = {
  pairs: PairOption[];
  selected: {
    cohortA: { id: string; name: string; grade_level: string | null; label: string };
    cohortB: { id: string; name: string; grade_level: string | null; label: string };
    label: string;
  } | null;
};

export function CohortPairSelector() {
  const { data, mutate } = useSWR<PairResponse>("/api/cohorts/pair", fetcher);

  const selected = data?.selected;
  const pairs = data?.pairs ?? [];

  const selectedKey = selected
    ? `${selected.cohortA.id},${selected.cohortB.id}`
    : "";

  async function onPairChange(value: string) {
    const [cohort_a_id, cohort_b_id] = value.split(",");
    if (!cohort_a_id || !cohort_b_id) return;
    const r = await fetch("/api/cohorts/pair", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohort_a_id, cohort_b_id }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "שגיאה");
      return;
    }
    await mutate();
    window.location.reload();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
      <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300">מחזורים נבחרים:</span>
      {selected ? (
        <>
          <span className="rounded-md bg-violet-50 px-2 py-1 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
            {selected.cohortA.label}
          </span>
          <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
            {selected.cohortB.label}
          </span>
        </>
      ) : (
        <span className="text-amber-700">לא הוגדר זוג מחזורים — פתחי מחזור חדש בהגדרות</span>
      )}
      {pairs.length > 0 ? (
        <label className="flex items-center gap-1.5">
          <span className="sr-only">בחירת זוג מחזורים</span>
          <select
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            value={selectedKey}
            onChange={(e) => void onPairChange(e.target.value)}
          >
            {!selectedKey ? <option value="">— בחרי זוג —</option> : null}
            {pairs.map((p) => (
              <option key={`${p.cohortAId},${p.cohortBId}`} value={`${p.cohortAId},${p.cohortBId}`}>
                {p.label}
                {p.isActivePair ? " (ברירת מחדל)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
