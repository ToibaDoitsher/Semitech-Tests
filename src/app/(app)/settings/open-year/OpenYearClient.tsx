"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListPageHeader, LIST_SECONDARY_LINK_CLASS } from "@/components/ui/ListPage";

export function OpenYearClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [newCohort, setNewCohort] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch("/api/academic-years/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), new_cohort_number: newCohort.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setMessage("השנה נפתחה בהצלחה");
      setTimeout(() => router.push("/students"), 1200);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <ListPageHeader title="פתיחת שנת לימודים" actions={<Link href="/settings" className={LIST_SECONDARY_LINK_CLASS}>חזרה</Link>} />
      <form onSubmit={(e) => void submit(e)} className="max-w-md space-y-3 rounded border bg-white p-4">
        <label className="block text-sm">שם שנה<input required className="mt-1 w-full border rounded px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block text-sm">מחזור חדש<input required type="number" min={1} className="mt-1 w-full border rounded px-2 py-1" value={newCohort} onChange={(e) => setNewCohort(e.target.value)} /></label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {message && <p className="text-green-700 text-sm">{message}</p>}
        <button disabled={busy} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm">{busy ? "..." : "פתיחת שנה"}</button>
      </form>
    </div>
  );
}
